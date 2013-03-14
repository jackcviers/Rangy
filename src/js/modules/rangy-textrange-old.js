/**
 * Text range module for Rangy.
 * Text-based manipulation and searching of ranges and selections.
 *
 * Features
 *
 * - Ability to move range boundaries by character or word offsets
 * - Customizable word tokenizer
 * - Ignores text nodes inside <script> or <style> elements or those hidden by CSS display and visibility properties
 * - Range findText method to search for text or regex within the page or within a range. Flags for whole words and case
 *   sensitivity
 * - Selection and range save/restore as text offsets within a node
 * - Methods to return visible text within a range or selection
 * - innerText method for elements
 *
 * References
 *
 * https://www.w3.org/Bugs/Public/show_bug.cgi?id=13145
 * http://aryeh.name/spec/innertext/innertext.html
 * http://dvcs.w3.org/hg/editing/raw-file/tip/editing.html
 *
 * Part of Rangy, a cross-browser JavaScript range and selection library
 * http://code.google.com/p/rangy/
 *
 * Depends on Rangy core.
 *
 * Copyright %%build:year%%, Tim Down
 * Licensed under the MIT license.
 * Version: %%build:version%%
 * Build date: %%build:date%%
 */

/**
 * Problem: handling of trailing spaces before line breaks is handled inconsistently between browsers.
 *
 * First, a <br>: this is relatively simple. For the following HTML:
 *
 * 1 <br>2
 *
 * - IE and WebKit render the space, include it in the selection (i.e. when the content is selected and pasted into a
 *   textarea, the space is present) and allow the caret to be placed after it.
 * - Firefox does not acknowledge the space in the selection but it is possible to place the caret after it.
 * - Opera does not render the space but has two separate caret positions on either side of the space (left and right
 *   arrow keys show this) and includes the space in the selection.
 *
 * The other case is the line break or breaks implied by block elements. For the following HTML:
 *
 * <p>1 </p><p>2<p>
 *
 * - WebKit does not acknowledge the space in any way
 * - Firefox, IE and Opera as per <br>
 *
 * One more case is trailing spaces before line breaks in elements with white-space: pre-line. For the following HTML:
 *
 * <p style="white-space: pre-line">1 
 * 2</p>
 *
 * - Firefox and WebKit include the space in caret positions
 * - IE does not support pre-line up to and including version 9
 * - Opera ignores the space
 * - Trailing space only renders if there is a non-collapsed character in the line 
 *
 * Problem is whether Rangy should ever acknowledge the space and if so, when. Another problem is whether this can be
 * feature-tested
 */
rangy.createModule("TextRange", function(api, module) {
    api.requireModules( ["WrappedSelection"] );

    var UNDEF = "undefined";
    var CHARACTER = "character", WORD = "word";
    var dom = api.dom, util = api.util, DomPosition = dom.DomPosition;
    var extend = util.extend;

    var log = log4javascript.getLogger("rangy.textrange");

    var spacesRegex = /^[ \t\f\r\n]+$/;
    var spacesMinusLineBreaksRegex = /^[ \t\f\r]+$/;
    var allWhiteSpaceRegex = /^[\t-\r \u0085\u00A0\u1680\u180E\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]+$/;
    var nonLineBreakWhiteSpaceRegex = /^[\t \u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]+$/;
    var lineBreakRegex = /^[\n-\r\u0085\u2028\u2029]$/;

    var defaultLanguage = "en";

    var isDirectionBackward = api.Selection.isDirectionBackward;

    // Test whether trailing spaces inside blocks are completely collapsed (as they are in WebKit, but not other
    // browsers). Also test whether trailing spaces before <br> elements are collapsed
    var trailingSpaceInBlockCollapses = true;
    var trailingSpaceBeforeBrCollapses = true;
    var trailingSpaceBeforeLineBreakInPreLineCollapses = true;
    
    var el = document.createElement("div");
/*
    if (util.isHostProperty(el, "innerText")) {
        el.innerHTML = "<p>&nbsp; </p><p></p>";
        document.body.appendChild(el);
        trailingSpaceInBlockCollapses = (!/ /.test(el.innerText));
        document.body.removeChild(el);

        el.innerHTML = "&nbsp; <br>";
        document.body.appendChild(el);
        trailingSpaceBeforeBrCollapses = (!/ /.test(el.innerText));
        document.body.removeChild(el);
    }
*/
    
    util.extend(api.features, {
        trailingSpaceInBlockCollapses: trailingSpaceInBlockCollapses,
        trailingSpaceBeforeBrCollapses: trailingSpaceBeforeBrCollapses
    });
    //alert([trailingSpaceBeforeBrCollapses, trailingSpaceInBlockCollapses])


    var getComputedStyleProperty;
    if (typeof window.getComputedStyle != UNDEF) {
        getComputedStyleProperty = function(el, propName, win) {
            return (win || dom.getWindow(el)).getComputedStyle(el, null)[propName];
        };
    } else if (typeof document.documentElement.currentStyle != UNDEF) {
        getComputedStyleProperty = function(el, propName) {
            return el.currentStyle[propName];
        };
    } else {
        module.fail("No means of obtaining computed style properties found");
    }

    // "A block node is either an Element whose "display" property does not have
    // resolved value "inline" or "inline-block" or "inline-table" or "none", or a
    // Document, or a DocumentFragment."
    function isBlockNode(node) {
        return node
            && ((node.nodeType == 1 && !/^(inline(-block|-table)?|none)$/.test(getComputedDisplay(node)))
            || node.nodeType == 9 || node.nodeType == 11);
    }

    function getLastDescendantOrSelf(node) {
        var lastChild = node.lastChild;
        return lastChild ? getLastDescendantOrSelf(lastChild) : node;
    }

    function containsPositions(node) {
        return dom.isCharacterDataNode(node)
            || !/^(area|base|basefont|br|col|frame|hr|img|input|isindex|link|meta|param)$/i.test(node.nodeName);
    }

    function getAncestors(node) {
        var ancestors = [];
        while (node.parentNode) {
            ancestors.unshift(node.parentNode);
            node = node.parentNode;
        }
        return ancestors;
    }

    function getAncestorsAndSelf(node) {
        return getAncestors(node).concat([node]);
    }

    // Opera 11 puts HTML elements in the null namespace, it seems, and IE 7 has undefined namespaceURI
    function isHtmlNode(node) {
        var ns;
        return typeof (ns = node.namespaceURI) == UNDEF || (ns === null || ns == "http://www.w3.org/1999/xhtml");
    }

    function isHtmlElement(node, tagNames) {
        if (!node || node.nodeType != 1 || !isHtmlNode(node)) {
            return false;
        }
        switch (typeof tagNames) {
            case "string":
                return node.tagName.toLowerCase() == tagNames.toLowerCase();
            case "object":
                return new RegExp("^(" + tagNames.join("|S") + ")$", "i").test(node.tagName);
            default:
                return true;
        }
    }

    function nextNodeDescendants(node) {
        while (node && !node.nextSibling) {
            node = node.parentNode;
        }
        if (!node) {
            return null;
        }
        return node.nextSibling;
    }

    function nextNode(node, excludeChildren) {
        if (!excludeChildren && node.hasChildNodes()) {
            return node.firstChild;
        }
        return nextNodeDescendants(node);
    }

    function previousNode(node) {
        var previous = node.previousSibling;
        if (previous) {
            node = previous;
            while (node.hasChildNodes()) {
                node = node.lastChild;
            }
            return node;
        }
        var parent = node.parentNode;
        if (parent && parent.nodeType == 1) {
            return parent;
        }
        return null;
    }

    function isHidden(node) {
        var ancestors = getAncestorsAndSelf(node);
        for (var i = 0, len = ancestors.length; i < len; ++i) {
            if (ancestors[i].nodeType == 1 && getComputedDisplay(ancestors[i]) == "none") {
                return true;
            }
        }

        return false;
    }

    function isVisibilityHiddenTextNode(textNode) {
        var el;
        return textNode.nodeType == 3
            && (el = textNode.parentNode)
            && getComputedStyleProperty(el, "visibility") == "hidden";
    }

    // Adpated from Aryeh's code.
    // "A whitespace node is either a Text node whose data is the empty string; or
    // a Text node whose data consists only of one or more tabs (0x0009), line
    // feeds (0x000A), carriage returns (0x000D), and/or spaces (0x0020), and whose
    // parent is an Element whose resolved value for "white-space" is "normal" or
    // "nowrap"; or a Text node whose data consists only of one or more tabs
    // (0x0009), carriage returns (0x000D), and/or spaces (0x0020), and whose
    // parent is an Element whose resolved value for "white-space" is "pre-line"."
    function isWhitespaceNode(node) {
        if (!node || node.nodeType != 3) {
            return false;
        }
        var text = node.data;
        if (text === "") {
            return true;
        }
        var parent = node.parentNode;
        if (!parent || parent.nodeType != 1) {
            return false;
        }
        var computedWhiteSpace = getComputedStyleProperty(node.parentNode, "whiteSpace");

        return (/^[\t\n\r ]+$/.test(text) && /^(normal|nowrap)$/.test(computedWhiteSpace))
            || (/^[\t\r ]+$/.test(text) && computedWhiteSpace == "pre-line");
    }

    // Adpated from Aryeh's code.
    // "node is a collapsed whitespace node if the following algorithm returns
    // true:"
    function isCollapsedWhitespaceNode(node) {
        // "If node's data is the empty string, return true."
        if (node.data == "") {
            return true;
        }

        // "If node is not a whitespace node, return false."
        if (!isWhitespaceNode(node)) {
            return false;
        }

        // "Let ancestor be node's parent."
        var ancestor = node.parentNode;

        // "If ancestor is null, return true."
        if (!ancestor) {
            return true;
        }

        // "If the "display" property of some ancestor of node has resolved value "none", return true."
        if (isHidden(node)) {
            return true;
        }

        // Algorithms further down the line decide whether the white space node is collapsed or not
        //return false;

        // "While ancestor is not a block node and its parent is not null, set
        // ancestor to its parent."
        while (!isBlockNode(ancestor) && ancestor.parentNode) {
            ancestor = ancestor.parentNode;
        }

        // "Let reference be node."
        var reference = node;

        // "While reference is a descendant of ancestor:"
        while (reference != ancestor) {
            // "Let reference be the node before it in tree order."
            reference = previousNode(reference);

            log.info("reference is " + dom.inspectNode(reference), isWhitespaceNode(reference));

            // "If reference is a block node or a br, return true."
            if (isBlockNode(reference) || isHtmlElement(reference, "br")) {
                return true;
            }

            // "If reference is a Text node that is not a whitespace node, or is an
            // img, break from this loop."
            if ((reference.nodeType == 3 && !isWhitespaceNode(reference)) || isHtmlElement(reference, "img")) {
                break;
            }
        }

        // "Let reference be node."
        reference = node;

        // "While reference is a descendant of ancestor:"
        var stop = nextNodeDescendants(ancestor);
        while (reference != stop) {
            // "Let reference be the node after it in tree order, or null if there
            // is no such node."
            reference = nextNode(reference);

            log.info("reference is " + dom.inspectNode(reference), isWhitespaceNode(reference));

            // "If reference is a block node or a br, return true."
            if (isBlockNode(reference) || isHtmlElement(reference, "br")) {
                return true;
            }

            // "If reference is a Text node that is not a whitespace node, or is an
            // img, break from this loop."
            if ((reference && reference.nodeType == 3 && !isWhitespaceNode(reference)) || isHtmlElement(reference, "img")) {
                break;
            }
        }

        // "Return false."
        return false;
    }

    // Test for old IE's incorrect display properties
    var tableCssDisplayBlock;
    (function() {
        var table = document.createElement("table");
        document.body.appendChild(table);
        tableCssDisplayBlock = (getComputedStyleProperty(table, "display") == "block");
        document.body.removeChild(table);
    })();

    api.features.tableCssDisplayBlock = tableCssDisplayBlock;

    var defaultDisplayValueForTag = {
        table: "table",
        caption: "table-caption",
        colgroup: "table-column-group",
        col: "table-column",
        thead: "table-header-group",
        tbody: "table-row-group",
        tfoot: "table-footer-group",
        tr: "table-row",
        td: "table-cell",
        th: "table-cell"
    };

    // Corrects IE's "block" value for table-related elements
    function getComputedDisplay(el, win) {
        var display = getComputedStyleProperty(el, "display", win);
        var tagName = el.tagName.toLowerCase();
        return (display == "block"
                && tableCssDisplayBlock
                && defaultDisplayValueForTag.hasOwnProperty(tagName))
            ? defaultDisplayValueForTag[tagName] : display;
    }

    function isCollapsedNode(node) {
        var type = node.nodeType;
        //log.debug("isCollapsedNode", isHidden(node), /^(script|style)$/i.test(node.nodeName), isCollapsedWhitespaceNode(node));
        return type == 7 /* PROCESSING_INSTRUCTION */
            || type == 8 /* COMMENT */
            || isHidden(node)
            || /^(script|style)$/i.test(node.nodeName)
            || isVisibilityHiddenTextNode(node)
            || isCollapsedWhitespaceNode(node);
    }

    function isIgnoredNode(node, win) {
        var type = node.nodeType;
        return type == 7 /* PROCESSING_INSTRUCTION */
            || type == 8 /* COMMENT */
            || (type == 1 && getComputedDisplay(node, win) == "none");
    }

    function hasInnerText(node) {
        if (!isCollapsedNode(node)) {
            if (node.nodeType == 3) {
                return true;
            } else {
                for (var child = node.firstChild; child; child = child.nextSibling) {
                    if (hasInnerText(child)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function getRangeStartPosition(range) {
        return new DomPosition(range.startContainer, range.startOffset);
    }

    function getRangeEndPosition(range) {
        return new DomPosition(range.endContainer, range.endOffset);
    }

    function TextPosition(character, position, isLeadingSpace, isTrailingSpace, isBr, collapsible) {
        this.character = character;
        this.position = position;
        this.isLeadingSpace = isLeadingSpace;
        this.isTrailingSpace = isTrailingSpace;
        this.isBr = isBr;
        this.collapsible = collapsible;
    }

    TextPosition.prototype.toString = function() {
        return this.character;
    };

    TextPosition.prototype.collapsesPrecedingSpace = function() {
        return (this.character == "\n") &&
            ( (this.isBr && trailingSpaceBeforeBrCollapses) || (this.isTrailingSpace && trailingSpaceInBlockCollapses) );
    };

    function getTrailingSpace(el) {
        if (el.tagName.toLowerCase() == "br") {
            return "";
        } else {
            switch (getComputedDisplay(el)) {
                case "inline":
                    var child = el.lastChild;
                    while (child) {
                        if (!isIgnoredNode(child)) {
                            return (child.nodeType == 1) ? getTrailingSpace(child) : "";
                        }
                        child = child.previousSibling;
                    }
                    break;
                case "inline-block":
                case "inline-table":
                case "none":
                case "table-column":
                case "table-column-group":
                    break;
                case "table-cell":
                    return "\t";
                default:
                    return hasInnerText(el) ? "\n" : "";
            }
        }
        return "";
    }

    function getLeadingSpace(el) {
        switch (getComputedDisplay(el)) {
            case "inline":
            case "inline-block":
            case "inline-table":
            case "none":
            case "table-column":
            case "table-column-group":
            case "table-cell":
                break;
            default:
                return hasInnerText(el) ? "\n" : "";
        }
        return "";
    }

    /*----------------------------------------------------------------------------------------------------------------*/

    /*
    Next and previous position moving functions that move between all possible positions in the document
     */
    function nextPosition(pos) {
        var node = pos.node, offset = pos.offset;
        if (!node) {
            return null;
        }
        var nextNode, nextOffset, child;
        if (offset == dom.getNodeLength(node)) {
            // Move onto the next node
            nextNode = node.parentNode;
            nextOffset = nextNode ? dom.getNodeIndex(node) + 1 : 0;
        } else {
            if (dom.isCharacterDataNode(node)) {
                nextNode = node;
                nextOffset = offset + 1;
            } else {
                child = node.childNodes[offset];
                // Go into the children next, if children there are
                if (containsPositions(child)) {
                    nextNode = child;
                    nextOffset = 0;
                } else {
                    nextNode = node;
                    nextOffset = offset + 1;
                }
            }
        }
        return nextNode ? new DomPosition(nextNode, nextOffset) : null;
    }

    function previousPosition(pos) {
        if (!pos) {
            return null;
        }
        var node = pos.node, offset = pos.offset;
        var previousNode, previousOffset, child;
        if (offset == 0) {
            previousNode = node.parentNode;
            previousOffset = previousNode ? dom.getNodeIndex(node) : 0;
        } else {
            if (dom.isCharacterDataNode(node)) {
                previousNode = node;
                previousOffset = offset - 1;
            } else {
                child = node.childNodes[offset - 1];
                // Go into the children next, if children there are
                if (containsPositions(child)) {
                    previousNode = child;
                    previousOffset = dom.getNodeLength(child);
                } else {
                    previousNode = node;
                    previousOffset = offset - 1;
                }
            }
        }
        return previousNode ? new DomPosition(previousNode, previousOffset) : null;
    }

    /*
    Next and previous position moving functions that filter out

    - Whole whitespace nodes that do not affect rendering
    - Hidden (CSS visibility/display) elements
    - Script and style elements
    - collapsed whitespace characters
     */
    function nextVisiblePosition(pos) {
        var next = nextPosition(pos);
        if (!next) {
            return null;
        }
        var node = next.node;
        var newPos = next;
        if (isCollapsedNode(node)) {
            // We're skipping this node and all its descendants
            newPos = new DomPosition(node.parentNode, dom.getNodeIndex(node) + 1);
        }
        return newPos;
    }

    function previousVisiblePosition(pos) {
        var previous = previousPosition(pos);
        if (!previous) {
            return null;
        }
        var node = previous.node;
        var newPos = previous;
        if (isCollapsedNode(node)) {
            // We're skipping this node and all its descendants
            newPos = new DomPosition(node.parentNode, dom.getNodeIndex(node));
        }
        return newPos;
    }

    function createTransaction(win, characterOptions) {
        return {
            characterOptions: characterOptions
        };
    }

    function getTextNodeProperties(textNode) {
        log.debug("getTextNodeProperties for " + textNode.data);
        var spaceRegex = null, collapseSpaces = false;
        var cssWhitespace = getComputedStyleProperty(textNode.parentNode, "whiteSpace");
        var preLine = (cssWhitespace == "pre-line");
        if (preLine) {
            spaceRegex = spacesMinusLineBreaksRegex;
            collapseSpaces = true;
        } else if (cssWhitespace == "normal" || cssWhitespace == "nowrap") {
            spaceRegex = spacesRegex;
            collapseSpaces = true;
        }

        return {
            node: textNode,
            text: textNode.data,
            spaceRegex: spaceRegex,
            collapseSpaces: collapseSpaces,
            preLine: preLine
        };
    }

    function getPossibleCharacterAt(pos, transaction, options) {
        var node = pos.node, offset = pos.offset;
        log.debug("getPossibleCharacterAt " + pos);
        var visibleChar = "", isLeadingSpace = false, isTrailingSpace = false, isBr = false, collapsible = false;
        if (offset > 0) {
            if (node.nodeType == 3) {
                var text = node.data;
                var textChar = text.charAt(offset - 1);
                log.debug("Got char '" + textChar + "' in data '" + text + "'");
                var nodeInfo = transaction.nodeInfo;
                if (!nodeInfo || nodeInfo.node !== node) {
                    transaction.nodeInfo = nodeInfo = getTextNodeProperties(node);
                }
                var spaceRegex = nodeInfo.spaceRegex;
                if (nodeInfo.collapseSpaces) {
                    if (spaceRegex.test(textChar)) {
                        collapsible = true;
                        // "If the character at position is from set, append a single space (U+0020) to newdata and advance
                        // position until the character at position is not from set."

                        // We also need to check for the case where we're in a pre-line and we have a space preceding a
                        // line break, because such spaces are collapsed in some browsers
                        if (offset > 1 && spaceRegex.test(text.charAt(offset - 2))) {
                            log.debug("Character is a collapsible space preceded by another collapsible space, skipping");
                        } else if (nodeInfo.preLine && text.charAt(offset) === "\n" && trailingSpaceBeforeBrCollapses && options.collapseSpaces) {
                            log.debug("Character is a collapsible space which is followed by a line break in a pre-line element, skipping");
                        } else {
                            log.debug("Character is a collapsible space not preceded by another collapsible space, adding");
                            visibleChar = " ";
                        }
                    } else {
                        log.debug("Character is not a space, adding");
                        visibleChar = textChar;
                    }
                } else {
                    log.debug("Spaces are not collapsible, so adding");
                    visibleChar = textChar;
                }
            } else {
                var nodePassed = node.childNodes[offset - 1];
                if (nodePassed && nodePassed.nodeType == 1 && !isCollapsedNode(nodePassed)) {
                    if (nodePassed.tagName.toLowerCase() == "br") {
                        log.debug("Node is br");
                        visibleChar = "\n";
                        isBr = true;
                    } else {
                        log.debug("Getting trailing space for node " + dom.inspectNode(nodePassed));
                        visibleChar = getTrailingSpace(nodePassed);
                        if (visibleChar) {
                            isTrailingSpace = collapsible = true;
                        }
                    }
                }

                // Check the leading space of the next node for the case when a block element follows an inline
                // element or text node. In that case, there is an implied line break between the two nodes.
                if (!visibleChar) {
                    var nextNode = node.childNodes[offset];
                    if (nextNode && nextNode.nodeType == 1 && !isCollapsedNode(nextNode)) {
                        log.debug("Getting leading space for node " + dom.inspectNode(nextNode) + " at position " + pos.inspect());
                        visibleChar = getLeadingSpace(nextNode);
                        if (visibleChar) {
                            log.debug("GOT LEADING SPACE AND USING IT");
                            isLeadingSpace = true;
                        }
                    }
                }
            }
        }
        return new TextPosition(visibleChar, pos, isLeadingSpace, isTrailingSpace, isBr, collapsible);
    }

/*
    function getPreviousPossibleCharacter(pos, transaction) {
        var previousPos = pos, previous;
        while ( (previousPos = previousVisiblePosition(previousPos)) ) {
            previous = getPossibleCharacterAt(previousPos, transaction);
            if (previous.character !== "") {
                return previous;
            }
        }
        return null;
    }
*/

    function getNextPossibleCharacter(pos, transaction) {
        var nextPos = pos, next;
        while ( (nextPos = nextVisiblePosition(nextPos)) ) {
            next = getPossibleCharacterAt(nextPos, transaction);
            if (next.character !== "") {
                return next;
            }
        }
        return null;
    }

    function getCharacterAt(pos, transaction, precedingChars, options) {
        var possible = getPossibleCharacterAt(pos, transaction);
        var possibleChar = possible.character;
        var next, preceding;
        log.group("*** getCharacterAt got possible char '" + possibleChar + "' at position " + pos);
        if (possibleChar) {
            if (spacesRegex.test(possibleChar)) {
                if (!precedingChars) {
                    // Work backwards until we have a non-space character
                    var previousPos = pos, previous, previousPossibleChar;
                    precedingChars = [];
                    while ( (previousPos = previousVisiblePosition(previousPos)) ) {
                        previous = getPossibleCharacterAt(previousPos, transaction);
                        previousPossibleChar = previous.character;
                        if (previousPossibleChar !== "") {
                            log.debug("Found preceding character '" + previousPossibleChar + "' at position " + previousPos);
                            precedingChars.unshift(previous);
                            if (previousPossibleChar != " " && previousPossibleChar != "\n") {
                                break;
                            }
                        }
                    }
                }
                preceding = precedingChars[precedingChars.length - 1];
    
                log.info("possible.collapsible: " + possible.collapsible + ", leading space: " + possible.isLeadingSpace + ", trailing space: " + possible.isTrailingSpace);
                if (preceding) {
                    log.info("preceding: '" + preceding + "' (" + preceding.position + "), possible: " + possible.position);
                    log.info([possible.isLeadingSpace, possibleChar == "\n", [!preceding, preceding.isLeadingSpace, !dom.isOrIsAncestorOf(possible.position.node.parentNode, preceding.position.node), dom.inspectNode(possible.position.node.parentNode), dom.inspectNode(preceding.position.node)]]);
                }
    
                // Disallow a collapsible space that follows a trailing space or line break, or is the first character
                if (possibleChar === " " && possible.collapsible &&
                        (!preceding || preceding.isTrailingSpace || preceding.character == "\n")) {
                    log.info("Preceding character is a trailing space or non-existent or follows a line break and current possible character is a collapsible space, so space is collapsed");
                    possible.character = "";
                }
    
                // Disallow a collapsible space that is followed by a line break or is the last character
                else if (possible.collapsible &&
                        (!(next = getNextPossibleCharacter(pos, transaction))
                            || (next.character == "\n" && options.collapseSpaceBeforeLineBreak && next.collapsesPrecedingSpace()))) {
                    log.debug("Character is a space which is followed by a line break that collapses preceding spaces, or nothing, so collapsing");
                    possible.character = "";
                }
    
                // Collapse a br element that is followed by a trailing space
                else if (possibleChar === "\n" && !possible.collapsible && (!(next = getNextPossibleCharacter(pos, transaction)) || next.isTrailingSpace)) {
                    log.debug("Character is a br which is followed by a trailing space or nothing, collapsing");
                    possible.character = "";
                }
            }
        }
        log.groupEnd();
        return possible;
    }


    function createCharacterIterator(startPos, backward, endPos, characterOptions) {
        log.info("createCharacterIterator called backwards " + backward + " and with endPos " + (endPos ? endPos.inspect() : ""));
        var transaction = createTransaction(dom.getWindow(startPos.node), characterOptions);

        // Adjust the end position to ensure that it is actually reached
        if (endPos) {
            if (backward) {
                if (isCollapsedNode(endPos.node)) {
                    endPos = previousVisiblePosition(endPos);
                }
            } else {
                if (isCollapsedNode(endPos.node)) {
                    endPos = nextVisiblePosition(endPos);
                }
            }
        }
        log.info("endPos now " + (endPos ? endPos.inspect() : "") + ", startPos " + startPos.inspect());

        var pos = startPos, finished = false;

        function next() {
            var textPos = null;
            if (!finished) {
                if (!backward) {
                    pos = nextVisiblePosition(pos);
                }
                if (pos) {
                    textPos = getCharacterAt(pos, transaction, null, characterOptions);
                    //log.debug("pos is " + pos.inspect() + ", endPos is " + (endPos ? endPos.inspect() : null) + ", equal is " + pos.equals(endPos));
                    if (endPos && pos.equals(endPos)) {
                        finished = true;
                    }
                } else {
                    finished = true;
                }
                if (backward) {
                    pos = previousVisiblePosition(pos);
                }
            }
            return textPos;
        }

        var previousTextPos, returnPreviousTextPos = false;

        return {
            next: function() {
                if (returnPreviousTextPos) {
                    returnPreviousTextPos = false;
                    return previousTextPos;
                } else {
                    var textPos;
                    while ( (textPos = next()) ) {
                        if (textPos.character) {
                            previousTextPos = textPos;
                            return textPos;
                        }
                    }
                }
            },

            rewind: function() {
                if (previousTextPos) {
                    returnPreviousTextPos = true;
                } else {
                    throw module.createError("createCharacterIterator: cannot rewind. Only one position can be rewound.");
                }
            },

            dispose: function() {
                startPos = endPos = transaction = null;
            }
        };
    }

    // This function must create word and non-word tokens for the whole of the text supplied to it
    function defaultTokenizer(chars, wordOptions) {
        var word = chars.join(""), result, tokens = [];

        function createTokenFromRange(start, end, isWord) {
            var tokenChars = chars.slice(start, end);
            var token = {
                isWord: isWord,
                chars: tokenChars,
                toString: function() { return tokenChars.join(""); }
            };
            for (var i = 0, len = tokenChars.length; i < len; ++i) {
                tokenChars[i].token = token;
            }
            tokens.push(token);
        }

        // Match words and mark characters
        var lastWordEnd = 0, wordStart, wordEnd;
        while ( (result = wordOptions.wordRegex.exec(word)) ) {
            wordStart = result.index;
            wordEnd = wordStart + result[0].length;

            // Create token for non-word characters preceding this word
            if (wordStart > lastWordEnd) {
                createTokenFromRange(lastWordEnd, wordStart, false);
            }

            // Get trailing space characters for word
            if (wordOptions.includeTrailingSpace) {
                while (nonLineBreakWhiteSpaceRegex.test(chars[wordEnd])) {
                    ++wordEnd;
                }
            }
            createTokenFromRange(wordStart, wordEnd, true);
            lastWordEnd = wordEnd;
        }

        // Create token for trailing non-word characters, if any exist
        if (lastWordEnd < chars.length) {
            createTokenFromRange(lastWordEnd, chars.length, false);
        }

        return tokens;
    }

    var arrayIndexOf = Array.prototype.indexOf ?
        function(arr, val) {
            return arr.indexOf(val);
        } :
        function(arr, val) {
            for (var i = 0, len = arr.length; i < len; ++i) {
                if (arr[i] === val) {
                    return i;
                }
            }
            return -1;
        };

    // Provides a pair of iterators over text positions, tokenized. Transparently requests more text when next()
    // is called and there is no more tokenized text
    function createTokenizedTextProvider(pos, characterOptions, wordOptions) {
        var forwardIterator = createCharacterIterator(pos, false, null, characterOptions);
        var backwardIterator = createCharacterIterator(pos, true, null, characterOptions);
        var tokenizer = wordOptions.tokenizer;

        // Consumes a word and the whitespace beyond it
        function consumeWord(forward) {
            log.debug("consumeWord called, forward is " + forward);
            var textPos, textChar;
            var newChars = [], it = forward ? forwardIterator : backwardIterator;

            var passedWordBoundary = false, insideWord = false;

            while ( (textPos = it.next()) ) {
                textChar = textPos.character;

                if (allWhiteSpaceRegex.test(textChar)) {
                    if (insideWord) {
                        insideWord = false;
                        passedWordBoundary = true;
                    }
                } else {
                    if (passedWordBoundary) {
                        it.rewind();
                        break;
                    } else {
                        insideWord = true;
                    }
                }
                newChars.push(textPos);
            }

            log.debug("consumeWord got new chars " + newChars.join(""));
            return newChars;
        }

        // Get initial word surrounding initial position and tokenize it
        var forwardChars = consumeWord(true);
        var backwardChars = consumeWord(false).reverse();
        var tokens = tokenizer(backwardChars.concat(forwardChars), wordOptions);

        // Create initial token buffers
        var forwardTokensBuffer = forwardChars.length ?
            tokens.slice(arrayIndexOf(tokens, forwardChars[0].token)) : [];

        var backwardTokensBuffer = backwardChars.length ?
            tokens.slice(0, arrayIndexOf(tokens, backwardChars.pop().token) + 1) : [];

        function inspectBuffer(buffer) {
            var textPositions = ["[" + buffer.length + "]"];
            for (var i = 0; i < buffer.length; ++i) {
                textPositions.push("(word: " + buffer[i] + ", is word: " + buffer[i].isWord + ")");
            }
            return textPositions;
        }

        log.info("Initial word: ", inspectBuffer(forwardTokensBuffer) + "", " and ", inspectBuffer(backwardTokensBuffer) + "", forwardChars, backwardChars);

        return {
            nextEndToken: function() {
                var lastToken, forwardChars;

                // If we're down to the last token, consume character chunks until we have a word or run out of
                // characters to consume
                while ( forwardTokensBuffer.length == 1 &&
                        !(lastToken = forwardTokensBuffer[0]).isWord &&
                        (forwardChars = consumeWord(true)).length > 0) {

                    // Merge trailing non-word into next word and tokenize
                    forwardTokensBuffer = tokenizer(lastToken.chars.concat(forwardChars), wordOptions);
                }

                return forwardTokensBuffer.shift();
            },

            previousStartToken: function() {
                var lastToken, backwardChars;

                // If we're down to the last token, consume character chunks until we have a word or run out of
                // characters to consume
                while ( backwardTokensBuffer.length == 1 &&
                        !(lastToken = backwardTokensBuffer[0]).isWord &&
                        (backwardChars = consumeWord(false)).length > 0) {

                    // Merge leading non-word into next word and tokenize
                    backwardTokensBuffer = tokenizer(backwardChars.reverse().concat(lastToken.chars), options);
                }

                return backwardTokensBuffer.pop();
            },

            dispose: function() {
                forwardIterator.dispose();
                backwardIterator.dispose();
                forwardTokensBuffer = backwardTokensBuffer = null;
            }
        };
    }

    var defaultCharacterOptions = {
        collapseSpaceBeforeLineBreak: true
    };

    function createOptions(optionsParam, defaults) {
        if (!optionsParam) {
            return defaults;
        } else {
            var options = {};
            extend(options, defaults);
            extend(options, optionsParam);
            return options;
        }
    }
    
    var defaultWordOptions = {
        "en": {
            wordRegex: /[a-z0-9]+('[a-z0-9]+)*/gi,
            includeTrailingSpace: false,
            tokenizer: defaultTokenizer
        }
    };

    function createWordOptions(options) {
        var lang, defaults;
        if (!options) {
            return defaultWordOptions[defaultLanguage];
        } else {
            lang = options.language || defaultLanguage;
            defaults = {};
            extend(defaults, defaultWordOptions[lang] || defaultWordOptions[defaultLanguage]);
            extend(defaults, options);
            return defaults;
        }
    }

    var defaultFindOptions = {
        caseSensitive: false,
        withinRange: null,
        wholeWordsOnly: false,
        wrap: false,
        direction: "forward",
        wordOptions: null,
        characterOptions: null
    };

    var defaultMoveOptions = {
        wordOptions: null,
        characterOptions: null
    };

    var defaultExpandOptions = {
        wordOptions: null,
        characterOptions: null,
        trim: false,
        trimStart: true,
        trimEnd: true
    };

    var defaultWordIteratorOptions = {
        wordOptions: null,
        characterOptions: null,
        direction: "forward"
    };

    function movePositionBy(pos, unit, count, characterOptions, wordOptions) {
        log.info("movePositionBy called " + count + ", pos " + pos.inspect());
        var unitsMoved = 0, newPos = pos, textPos, charIterator, nextTextPos, newTextPos, absCount = Math.abs(count), token;
        if (count !== 0) {
            var backward = (count < 0);

            switch (unit) {
                case CHARACTER:
                    charIterator = createCharacterIterator(pos, backward, null, characterOptions);
                    while ( (textPos = charIterator.next()) && unitsMoved < absCount ) {
                        log.info("*** movePositionBy GOT CHAR " + textPos.character + "[" + textPos.character.charCodeAt(0) + "]");
                        ++unitsMoved;
                        newTextPos = textPos;
                    }
                    nextTextPos = textPos;
                    charIterator.dispose();
                    break;
                case WORD:
                    var tokenizedTextProvider = createTokenizedTextProvider(pos, characterOptions, wordOptions);
                    var next = backward ? tokenizedTextProvider.previousStartToken : tokenizedTextProvider.nextEndToken;

                    while ( (token = next()) && unitsMoved < absCount ) {
                        log.debug("token: " + token.chars.join(""), token.isWord);
                        if (token.isWord) {
                            ++unitsMoved;
                            log.info("**** FOUND END OF WORD. unitsMoved NOW " + unitsMoved);
                            newTextPos = backward ? token.chars[0] : token.chars[token.chars.length - 1];
                        }
                    }
                    break;
                default:
                    throw new Error("movePositionBy: unit '" + unit + "' not implemented");
            }

            // Perform any necessary position tweaks
            if (newTextPos) {
                newPos = newTextPos.position;
            }
            if (backward) {
                log.debug("Adjusting position. Current newPos: " + newPos);
                newPos = previousVisiblePosition(newPos);
                log.debug("newPos now: " + newPos);
                unitsMoved = -unitsMoved;
            } else if (newTextPos && newTextPos.isLeadingSpace) {
                // Tweak the position for the case of a leading space. The problem is that an uncollapsed leading space
                // before a block element (for example, the line break between "1" and "2" in the following HTML:
                // "1<p>2</p>") is considered to be attached to the position immediately before the block element, which
                // corresponds with a different selection position in most browsers from the one we want (i.e. at the
                // start of the contents of the block element). We get round this by advancing the position returned to
                // the last possible equivalent visible position.
                log.info("movePositionBy ended immediately after a leading space at " + newPos);
                if (unit == WORD) {
                    charIterator = createCharacterIterator(pos, false, null, characterOptions);
                    nextTextPos = charIterator.next();
                    charIterator.dispose();
                }
                if (nextTextPos) {
                    newPos = previousVisiblePosition(nextTextPos.position);
                    log.info("movePositionBy adjusted leading space position to " + newPos);
                }
            }
        }

        return {
            position: newPos,
            unitsMoved: unitsMoved
        };
    }

    function createRangeCharacterIterator(range, characterOptions, backward) {
        var rangeStart = getRangeStartPosition(range), rangeEnd = getRangeEndPosition(range);
        var itStart = backward ? rangeEnd : rangeStart, itEnd = backward ? rangeStart : rangeEnd;
        return createCharacterIterator(itStart, !!backward, itEnd, characterOptions);
    }

    function getRangeCharacters(range, characterOptions) {
        log.info("getRangeCharacters called on range " + range.inspect());

        var chars = [], it = createRangeCharacterIterator(range, characterOptions), textPos;
        while ( (textPos = it.next()) ) {
            log.info("*** GOT CHAR " + textPos.character + "[" + textPos.character.charCodeAt(0) + "]");
            chars.push(textPos);
        }

        it.dispose();
        return chars;
    }

    function isWholeWord(startPos, endPos, wordOptions) {
        var range = api.createRange(startPos.node);
        range.setStart(startPos.node, startPos.offset);
        range.setEnd(endPos.node, endPos.offset);
        var returnVal = !range.expand("word", wordOptions);
        range.detach();
        return returnVal;
    }

    function findTextFromPosition(initialPos, searchTerm, isRegex, searchScopeRange, findOptions) {
        log.debug("findTextFromPosition called with search term " + searchTerm + ", initialPos " + initialPos.inspect() + " within range " + searchScopeRange.inspect());
        var backward = isDirectionBackward(findOptions.direction);
        var it = createCharacterIterator(
            initialPos,
            backward,
            backward ? getRangeStartPosition(searchScopeRange) : getRangeEndPosition(searchScopeRange),
            findOptions
        );
        var text = "", chars = [], textPos, currentChar, matchStartIndex, matchEndIndex;
        var result, insideRegexMatch;
        var returnValue = null;

        function handleMatch(startIndex, endIndex) {
            var startPos = previousVisiblePosition(chars[startIndex].position);
            var endPos = chars[endIndex - 1].position;
            var valid = (!findOptions.wholeWordsOnly || isWholeWord(startPos, endPos, findOptions.wordOptions));

            return {
                startPos: startPos,
                endPos: endPos,
                valid: valid
            };
        }

        while ( (textPos = it.next()) ) {
            currentChar = textPos.character;
            currentChar = textPos.character;
            if (!isRegex && !findOptions.caseSensitive) {
                currentChar = currentChar.toLowerCase();
            }

            if (backward) {
                chars.unshift(textPos);
                text = currentChar + text;
            } else {
                chars.push(textPos);
                text += currentChar;
            }

            if (isRegex) {
                result = searchTerm.exec(text);
                if (result) {
                    if (insideRegexMatch) {
                        // Check whether the match is now over
                        matchStartIndex = result.index;
                        matchEndIndex = matchStartIndex + result[0].length;
                        if ((!backward && matchEndIndex < text.length) || (backward && matchStartIndex > 0)) {
                            returnValue = handleMatch(matchStartIndex, matchEndIndex);
                            break;
                        }
                    } else {
                        insideRegexMatch = true;
                    }
                }
            } else if ( (matchStartIndex = text.indexOf(searchTerm)) != -1 ) {
                returnValue = handleMatch(matchStartIndex, matchStartIndex + searchTerm.length);
                break;
            }
        }

        // Check whether regex match extends to the end of the range
        if (insideRegexMatch) {
            returnValue = handleMatch(matchStartIndex, matchEndIndex);
        }
        it.dispose();

        return returnValue;
    }

    /*----------------------------------------------------------------------------------------------------------------*/

    // Extensions to the rangy.dom utility object

    extend(dom, {
        nextNode: nextNode,
        previousNode: previousNode,
        hasInnerText: hasInnerText
    });

    /*----------------------------------------------------------------------------------------------------------------*/

    // Extensions to the Rangy Range object

    function createRangeBoundaryMover(isStart, collapse) {
        /*
        Unit can be "character" or "word"
        Options:

        - includeTrailingSpace
        - wordRegex
        - tokenizer
        - collapseSpaceBeforeLineBreak
        */
        return function(unit, count, moveOptions) {
            if (typeof count == "undefined") {
                count = unit;
                unit = CHARACTER;
            }
            moveOptions = createOptions(moveOptions, defaultMoveOptions);
            var characterOptions = createOptions(moveOptions.characterOptions, defaultCharacterOptions);
            var wordOptions = createWordOptions(moveOptions.wordOptions);
            log.debug("** moving boundary. start: " + isStart + ", unit: " + unit + ", count: " + count);

            var boundaryIsStart = isStart;
            if (collapse) {
                boundaryIsStart = (count >= 0);
                this.collapse(!boundaryIsStart);
            }
            var rangePositionGetter = boundaryIsStart ? getRangeStartPosition : getRangeEndPosition;
            var moveResult = movePositionBy(rangePositionGetter(this), unit, count, characterOptions, wordOptions);
            var newPos = moveResult.position;
            this[boundaryIsStart ? "setStart" : "setEnd"](newPos.node, newPos.offset);
            return moveResult.unitsMoved;
        };
    }

    function createRangeTrimmer(isStart) {
        return function(characterOptions) {
            characterOptions = createOptions(characterOptions, defaultCharacterOptions);
            var textPos;
            var it = createRangeCharacterIterator(this, characterOptions, !isStart);
            var trimCharCount = 0;
            while ( (textPos = it.next()) && allWhiteSpaceRegex.test(textPos.character) ) {
                ++trimCharCount;
            }
            it.dispose();
            var trimmed = (trimCharCount > 0);
            if (trimmed) {
                this[isStart ? "moveStart" : "moveEnd"](
                    "character",
                    isStart ? trimCharCount : -trimCharCount,
                    { characterOptions: characterOptions }
                );
            }
            return trimmed;
        };
    }
    
    extend(api.rangePrototype, {
        moveStart: createRangeBoundaryMover(true, false),

        moveEnd: createRangeBoundaryMover(false, false),

        move: createRangeBoundaryMover(true, true),
        
        trimStart: createRangeTrimmer(true),

        trimEnd: createRangeTrimmer(false),
        
        trim: function(characterOptions) {
            var startTrimmed = this.trimStart(characterOptions), endTrimmed = this.trimEnd(characterOptions);
            return startTrimmed || endTrimmed;
        },

        expand: function(unit, expandOptions) {
            var moved = false;
            expandOptions = createOptions(expandOptions, defaultExpandOptions);
            var characterOptions = createOptions(expandOptions.characterOptions, defaultCharacterOptions);
            if (!unit) {
                unit = CHARACTER;
            }
            if (unit == WORD) {
                var wordOptions = createWordOptions(expandOptions.wordOptions);
                var startPos = getRangeStartPosition(this);
                var endPos = getRangeEndPosition(this);

                var startTokenizedTextProvider = createTokenizedTextProvider(startPos, characterOptions, wordOptions);
                var startToken = startTokenizedTextProvider.nextEndToken();
                var newStartPos = previousVisiblePosition(startToken.chars[0].position);
                var endToken, newEndPos;

                if (this.collapsed) {
                    endToken = startToken;
                } else {
                    var endTokenizedTextProvider = createTokenizedTextProvider(endPos, characterOptions, wordOptions);
                    endToken = endTokenizedTextProvider.previousStartToken();
                }
                newEndPos = endToken.chars[endToken.chars.length - 1].position;

                if (!newStartPos.equals(startPos)) {
                    this.setStart(newStartPos.node, newStartPos.offset);
                    moved = true;
                }
                if (!newEndPos.equals(endPos)) {
                    this.setEnd(newEndPos.node, newEndPos.offset);
                    moved = true;
                }

                if (expandOptions.trim) {
                    if (expandOptions.trimStart) {
                        moved = this.trimStart(characterOptions) || moved;
                    }
                    if (expandOptions.trimEnd) {
                        moved = this.trimEnd(characterOptions) || moved;
                    }
                }
                
                return moved;
            } else {
                return this.moveEnd(CHARACTER, 1, expandOptions);
            }
        },

        text: function(characterOptions) {
            return this.collapsed ?
                "" : getRangeCharacters(this, createOptions(characterOptions, defaultCharacterOptions)).join("");
        },

        selectCharacters: function(containerNode, startIndex, endIndex, characterOptions) {
            var moveOptions = { characterOptions: characterOptions };
            this.selectNodeContents(containerNode);
            this.collapse(true);
            this.moveStart("character", startIndex, moveOptions);
            this.collapse(true);
            this.moveEnd("character", endIndex - startIndex, moveOptions);
        },

        // Character indexes are relative to the start of node
        toCharacterRange: function(containerNode, characterOptions) {
            if (!containerNode) {
                containerNode = document.body;
            }
            var parent = containerNode.parentNode, nodeIndex = dom.getNodeIndex(containerNode);
            var rangeStartsBeforeNode = (dom.comparePoints(this.startContainer, this.endContainer, parent, nodeIndex) == -1);
            var rangeBetween = this.cloneRange();
            var startIndex, endIndex;
            if (rangeStartsBeforeNode) {
                rangeBetween.setStart(this.startContainer, this.startOffset);
                rangeBetween.setEnd(parent, nodeIndex);
                startIndex = -rangeBetween.text(characterOptions).length;
            } else {
                rangeBetween.setStart(parent, nodeIndex);
                rangeBetween.setEnd(this.startContainer, this.startOffset);
                startIndex = rangeBetween.text(characterOptions).length;
            }
            endIndex = startIndex + this.text(characterOptions).length;

            return {
                start: startIndex,
                end: endIndex
            };
        },

        findText: function(searchTermParam, findOptions) {
            // Set up options
            findOptions = createOptions(findOptions, defaultFindOptions);

            // Create word options if we're matching whole words only
            if (findOptions.wholeWordsOnly) {
                findOptions.wordOptions = createWordOptions(findOptions.wordOptions);

                // We don't ever want trailing spaces for search results
                findOptions.wordOptions.includeTrailingSpace = false;
            }

            var backward = isDirectionBackward(findOptions.direction);

            // Create a range representing the search scope if none was provided
            var searchScopeRange = findOptions.withinRange;
            if (!searchScopeRange) {
                searchScopeRange = api.createRange();
                searchScopeRange.selectNodeContents(this.getDocument());
            }

            // Examine and prepare the search term
            var searchTerm = searchTermParam, isRegex = false;
            if (typeof searchTerm == "string") {
                if (!findOptions.caseSensitive) {
                    searchTerm = searchTerm.toLowerCase();
                }
            } else {
                isRegex = true;
            }

            var initialPos = backward ? getRangeEndPosition(this) : getRangeStartPosition(this);

            // Adjust initial position if it lies outside the search scope
            var comparison = searchScopeRange.comparePoint(initialPos.node, initialPos.offset);
            if (comparison === -1) {
                initialPos = getRangeStartPosition(searchScopeRange);
            } else if (comparison === 1) {
                initialPos = getRangeEndPosition(searchScopeRange);
            }

            var pos = initialPos;
            var wrappedAround = false;

            // Try to find a match and ignore invalid ones
            var findResult;
            while (true) {
                findResult = findTextFromPosition(pos, searchTerm, isRegex, searchScopeRange, findOptions);

                if (findResult) {
                    if (findResult.valid) {
                        this.setStart(findResult.startPos.node, findResult.startPos.offset);
                        this.setEnd(findResult.endPos.node, findResult.endPos.offset);
                        return true;
                    } else {
                        // We've found a match that is not a whole word, so we carry on searching from the point immediately
                        // after the match
                        pos = backward ? findResult.startPos : findResult.endPos;
                    }
                } else if (findOptions.wrap && !wrappedAround) {
                    // No result found but we're wrapping around and limiting the scope to the unsearched part of the range
                    searchScopeRange = searchScopeRange.cloneRange();
                    if (backward) {
                        pos = getRangeEndPosition(searchScopeRange);
                        searchScopeRange.setStart(initialPos.node, initialPos.offset);
                    } else {
                        pos = getRangeStartPosition(searchScopeRange);
                        searchScopeRange.setEnd(initialPos.node, initialPos.offset);
                    }
                    log.debug("Wrapping search. New search range is " + searchScopeRange.inspect());
                    wrappedAround = true;
                } else {
                    // Nothing found and we can't wrap around, so we're done
                    return false;
                }
            }
        },

        pasteHtml: function(html) {
            this.deleteContents();
            if (html) {
                var frag = this.createContextualFragment(html);
                var lastChild = frag.lastChild;
                this.insertNode(frag);
                this.collapseAfter(lastChild);
            }
        }
    });

    /*----------------------------------------------------------------------------------------------------------------*/

    // Extensions to the Rangy Selection object
    
    function createSelectionTrimmer(methodName) {
        return function(characterOptions) {
            var trimmed = false;
            this.changeEachRange(function(range) {
                trimmed = range[methodName](characterOptions) || trimmed;
            });
            return trimmed;
        }
    }

    extend(api.selectionPrototype, {
        expand: function(unit, expandOptions) {
            this.changeEachRange(function(range) {
                range.expand(unit, expandOptions);
            });
        },

        move: function(unit, count, options) {
            if (this.focusNode) {
                this.collapse(this.focusNode, this.focusOffset);
                var range = this.getRangeAt(0);
                range.move(unit, count, options);
                this.setSingleRange(range);
            }
        },
        
        trimStart: createSelectionTrimmer("trimStart"),
        trimEnd: createSelectionTrimmer("trimEnd"),
        trim: createSelectionTrimmer("trim"),

        selectCharacters: function(containerNode, startIndex, endIndex, direction, characterOptions) {
            var range = api.createRange(containerNode);
            range.selectCharacters(containerNode, startIndex, endIndex, characterOptions);
            this.setSingleRange(range, direction);
        },

        saveCharacterRanges: function(containerNode, characterOptions) {
            var ranges = this.getAllRanges(), rangeCount = ranges.length;
            var characterRanges = [];

            var backward = rangeCount == 1 && this.isBackward();

            for (var i = 0, len = ranges.length; i < len; ++i) {
                characterRanges[i] = {
                    range: ranges[i].toCharacterRange(containerNode, characterOptions),
                    backward: backward,
                    characterOptions: characterOptions
                };
            }

            return characterRanges;
        },

        restoreCharacterRanges: function(containerNode, characterRanges) {
            this.removeAllRanges();
            for (var i = 0, len = characterRanges.length, range, characterRange; i < len; ++i) {
                characterRange = characterRanges[i];
                range = api.createRange(containerNode);
                range.selectCharacters(containerNode, characterRange.range.start, characterRange.range.end, characterRange.characterOptions);
                this.addRange(range, characterRange.backward);
            }
        },

        text: function(characterOptions) {
            var rangeTexts = [];
            for (var i = 0, len = this.rangeCount; i < len; ++i) {
                rangeTexts[i] = this.getRangeAt(i).text(characterOptions);
            }
            return rangeTexts.join("");
        }
    });

    /*----------------------------------------------------------------------------------------------------------------*/

    // Extensions to the core rangy object

    api.innerText = function(el, characterOptions) {
        var range = api.createRange(el);
        range.selectNodeContents(el);
        var text = range.text(characterOptions);
        range.detach();
        log.debug("innerText is '" + text.replace(/\s/g, function(matched) { return "[" + matched.charCodeAt(0) + "]"; }) + "'");
        return text;
    };

    api.createWordIterator = function(startNode, startOffset, iteratorOptions) {
        iteratorOptions = createOptions(iteratorOptions, defaultWordIteratorOptions);
        characterOptions = createOptions(iteratorOptions.characterOptions, defaultCharacterOptions);
        wordOptions = createWordOptions(iteratorOptions.wordOptions);
        var startPos = new DomPosition(startNode, startOffset);
        var tokenizedTextProvider = createTokenizedTextProvider(startPos, characterOptions, wordOptions);
        var backward = isDirectionBackward(iteratorOptions.direction);

        return {
            next: function() {
                return backward ? tokenizedTextProvider.previousStartToken() : tokenizedTextProvider.nextEndToken();
            },

            dispose: function() {
                tokenizedTextProvider.dispose();
                this.next = function() {};
            }
        };
    };

    /*----------------------------------------------------------------------------------------------------------------*/

    api.textRange = {
        isBlockNode: isBlockNode,
        isCollapsedWhitespaceNode: isCollapsedWhitespaceNode,
        nextPosition: nextPosition,
        previousPosition: previousPosition,
        nextVisiblePosition: nextVisiblePosition,
        previousVisiblePosition: previousVisiblePosition
    };

});
