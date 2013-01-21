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
 * Copyright 2013, Tim Down
 * Licensed under the MIT license.
 * Version: 1.3alpha.738
 * Build date: 21 January 2013
 */
rangy.createModule("TextRange",function(a,b){function s(a,b){function f(b,c,d){var f=a.slice(b,c),g={isWord:d,chars:f,toString:function(){return f.join("")}};for(var h=0,i=f.length;h<i;++h)f[h].token=g;e.push(g)}var c=a.join(""),d,e=[],g=0,h,i;while(d=b.wordRegex.exec(c)){h=d.index,i=h+d[0].length,h>g&&f(g,h,!1);if(b.includeTrailingSpace)while(l.test(a[i]))++i;f(h,i,!0),g=i}return g<a.length&&f(g,a.length,!1),e}function w(a,b){if(!a)return b;var c={};return h(c,b),h(c,a),c}function x(a){var b,c;return a?(b=a.language||n,c={},h(c,v[b]||v[n]),h(c,a),c):v[n]}function y(a){return w(a,t)}function z(a){return w(a,u)}function E(a,b){this.start=a,this.end=b}function I(a,b){var c=F(a,"display",b),d=a.tagName.toLowerCase();return c=="block"&&G&&H.hasOwnProperty(d)?H[d]:c}function J(a){var b=P(a);for(var c=0,d=b.length;c<d;++c)if(b[c].nodeType==1&&I(b[c])=="none")return!0;return!1}function K(a){var b;return a.nodeType==3&&(b=a.parentNode)&&F(b,"visibility")=="hidden"}function L(a){return a&&(a.nodeType==1&&!/^(inline(-block|-table)?|none)$/.test(I(a))||a.nodeType==9||a.nodeType==11)}function M(a){var b=a.lastChild;return b?M(b):a}function N(a){return f.isCharacterDataNode(a)||!/^(area|base|basefont|br|col|frame|hr|img|input|isindex|link|meta|param)$/i.test(a.nodeName)}function O(a){var b=[];while(a.parentNode)b.unshift(a.parentNode),a=a.parentNode;return b}function P(a){return O(a).concat([a])}function Q(a){var b;return typeof (b=a.namespaceURI)==c||b===null||b=="http://www.w3.org/1999/xhtml"}function R(a,b){if(!a||a.nodeType!=1||!Q(a))return!1;switch(typeof b){case"string":return a.tagName.toLowerCase()==b.toLowerCase();case"object":return(new RegExp("^("+b.join("|S")+")$","i")).test(a.tagName);default:return!0}}function S(a){while(a&&!a.nextSibling)a=a.parentNode;return a?a.nextSibling:null}function T(a,b){return!b&&a.hasChildNodes()?a.firstChild:S(a)}function U(a){var b=a.previousSibling;if(b){a=b;while(a.hasChildNodes())a=a.lastChild;return a}var c=a.parentNode;return c&&c.nodeType==1?c:null}function V(a){if(!a||a.nodeType!=3)return!1;var b=a.data;if(b==="")return!0;var c=a.parentNode;if(!c||c.nodeType!=1)return!1;var d=F(a.parentNode,"whiteSpace");return/^[\t\n\r ]+$/.test(b)&&/^(normal|nowrap)$/.test(d)||/^[\t\r ]+$/.test(b)&&d=="pre-line"}function W(a){if(a.data==="")return!0;if(!V(a))return!1;var b=a.parentNode;return b?J(a)?!0:!1:!0}function X(a){var b=a.nodeType;return b==7||b==8||J(a)||/^(script|style)$/i.test(a.nodeName)||K(a)||W(a)}function Y(a,b){var c=a.nodeType;return c==7||c==8||c==1&&I(a,b)=="none"}function Z(){this.store={}}function $(a,b,c){return function(d){var e=this.cache;if(e.hasOwnProperty(a))return e[a];var f=b.call(this,c?this[c]:this,d);return e[a]=f,f}}function _(a,b){this.node=a,this.session=b,this.cache=new Z,this.positions=new Z}function ib(a,b){this.offset=b,this.nodeWrapper=a,this.node=a.node,this.session=a.session,this.cache=new Z}function jb(){return"[Position("+f.inspectNode(this.node)+":"+this.offset+")]"}function nb(){return pb(),lb=new mb}function ob(){return lb||nb()}function pb(){lb&&lb.detach(),lb=null}function qb(a,c,d,e){function h(){var a=null,b=null;return c?(b=f,g||(f=f.previousVisible(),g=!f||d&&f.equals(d))):g||(b=f=f.nextVisible(),g=!f||d&&f.equals(d)),g&&(f=null),b}d&&(c?X(d.node)&&(d=a.previousVisible()):X(d.node)&&(d=d.nextVisible()));var f=a,g=!1,i,j=!1;return{next:function(){if(j)return j=!1,i;var a,b;while(a=h()){b=a.getCharacter(e);if(b)return i=a,a}return null},rewind:function(){if(!i)throw b.createError("createCharacterIterator: cannot rewind. Only one position can be rewound.");j=!0},dispose:function(){a=d=null}}}function sb(a,b,c){function g(a){var b,c,f=[],g=a?d:e,h=!1,i=!1;while(b=g.next()){c=b.character;if(k.test(c))i&&(i=!1,h=!0);else{if(h){g.rewind();break}i=!0}f.push(b)}return f}function n(a){var b=["["+a.length+"]"];for(var c=0;c<a.length;++c)b.push("(word: "+a[c]+", is word: "+a[c].isWord+")");return b}var d=qb(a,!1,null,b),e=qb(a,!0,null,b),f=c.tokenizer,h=g(!0),i=g(!1).reverse(),j=f(i.concat(h),c),l=h.length?j.slice(rb(j,h[0].token)):[],m=i.length?j.slice(0,rb(j,i.pop().token)+1):[];return{nextEndToken:function(){var a,b;while(l.length==1&&!(a=l[0]).isWord&&(b=g(!0)).length>0)l=f(a.chars.concat(b),c);return l.shift()},previousStartToken:function(){var a,b;while(m.length==1&&!(a=m[0]).isWord&&(b=g(!1)).length>0)m=f(b.reverse().concat(a.chars),c);return m.pop()},dispose:function(){d.dispose(),e.dispose(),l=m=null}}}function tb(a,b,c,f,g){var h=0,i,j=a,k,l,m=Math.abs(c),n;if(c!==0){var o=c<0;switch(b){case d:k=qb(a,o,null,f);while((i=k.next())&&h<m)++h,j=i;l=i,k.dispose();break;case e:var p=sb(a,f,g),q=o?p.previousStartToken:p.nextEndToken;while((n=q())&&h<m)n.isWord&&(++h,j=o?n.chars[0]:n.chars[n.chars.length-1]);break;default:throw new Error("movePositionBy: unit '"+b+"' not implemented")}o?(j=j.previousVisible(),h=-h):j&&j.isLeadingSpace&&(b==e&&(k=qb(a,!1,null,f),l=k.next(),k.dispose()),l&&(j=l.previousVisible()))}return{position:j,unitsMoved:h}}function ub(a,b,c,d){var e=a.getRangeBoundaryPosition(b,!0),f=a.getRangeBoundaryPosition(b,!1),g=d?f:e,h=d?e:f;return qb(g,!!d,h,c)}function vb(a,b,c){var d=[],e=ub(a,b,c),f;while(f=e.next())d.push(f);return e.dispose(),d}function wb(b,c,d){var e=a.createRange(b.node);e.setStartAndEnd(b.node,b.offset,c.node,c.offset);var f=!e.expand("word",d);return e.detach(),f}function xb(a,b,c,d,e){function r(a,b){var c=i[a].previousVisible(),d=i[b-1],f=!e.wholeWordsOnly||wb(c,d,e.wordOptions);return{startPos:c,endPos:d,valid:f}}var f=o(e.direction),g=qb(a,f,a.session.getRangeBoundaryPosition(d,f),e),h="",i=[],j,k,l,m,n,p,q=null;while(j=g.next()){k=j.character,!c&&!e.caseSensitive&&(k=k.toLowerCase()),f?(i.unshift(j),h=k+h):(i.push(j),h+=k);if(c){n=b.exec(h);if(n)if(p){l=n.index,m=l+n[0].length;if(!f&&m<h.length||f&&l>0){q=r(l,m);break}}else p=!0}else if((l=h.indexOf(b))!=-1){q=r(l,l+b.length);break}}return p&&(q=r(l,m)),g.dispose(),q}function yb(a){return function(){var b=!!lb,c=ob(),d=[c].concat(g.toArray(arguments)),e=a.apply(this,d);return b||pb(),e}}function zb(a,b){return yb(function(c,e,f,g){typeof f=="undefined"&&(f=e,e=d),g=w(g,B);var h=y(g.characterOptions),i=x(g.wordOptions),j=a;b&&(j=f>=0,this.collapse(!j));var k=tb(c.getRangeBoundaryPosition(this,j),e,f,h,i),l=k.position;return this[j?"setStart":"setEnd"](l.node,l.offset),k.unitsMoved})}function Ab(a){return yb(function(b,c){c=y(c);var d,e=ub(b,this,c,!a),f=0;while((d=e.next())&&k.test(d.character))++f;e.dispose();var g=f>0;return g&&this[a?"moveStart":"moveEnd"]("character",a?f:-f,{characterOptions:c}),g})}function Bb(a){return yb(function(b,c){var d=!1;return this.changeEachRange(function(b){d=b[a](c)||d}),d})}a.requireModules(["WrappedSelection"]);var c="undefined",d="character",e="word",f=a.dom,g=a.util,h=g.extend,i=/^[ \t\f\r\n]+$/,j=/^[ \t\f\r]+$/,k=/^[\t-\r \u0085\u00A0\u1680\u180E\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]+$/,l=/^[\t \u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]+$/,m=/^[\n-\r\u0085\u2028\u2029]$/,n="en",o=a.Selection.isDirectionBackward,p=!1,q=!1,r=!0;(function(){var b=document.createElement("div");b.innerHTML="<p>1 </p><p></p>";var c=document.body,d=b.firstChild,e=a.getSelection();c.appendChild(b),e.collapse(d.lastChild,2),e.setStart(d.firstChild,0),p=(""+e).length==1,b.innerHTML="1 <br>",e.collapse(b,2),e.setStart(b.firstChild,0),q=(""+e).length==1,c.removeChild(b),e.removeAllRanges()})();var t={includeBlockContentTrailingSpace:!0,includeSpaceBeforeBr:!0,includePreLineTrailingSpace:!0},u={includeBlockContentTrailingSpace:!r,includeSpaceBeforeBr:!q,includePreLineTrailingSpace:!0},v={en:{wordRegex:/[a-z0-9]+('[a-z0-9]+)*/gi,includeTrailingSpace:!1,tokenizer:s}},A={caseSensitive:!1,withinRange:null,wholeWordsOnly:!1,wrap:!1,direction:"forward",wordOptions:null,characterOptions:null},B={wordOptions:null,characterOptions:null},C={wordOptions:null,characterOptions:null,trim:!1,trimStart:!0,trimEnd:!0},D={wordOptions:null,characterOptions:null,direction:"forward"};E.prototype={intersects:function(a){return this.start<a.end&&this.end>a.start},union:function(a){return new E(Math.min(this.start,a.start),Math.max(this.end,a.end))},toString:function(){return"[CharacterRange("+this.start+", "+this.end+")]"}},a.CharacterRange=E;var F=f.getComputedStyleProperty,G;(function(){var a=document.createElement("table");document.body.appendChild(a),G=F(a,"display")=="block",document.body.removeChild(a)})(),a.features.tableCssDisplayBlock=G;var H={table:"table",caption:"table-caption",colgroup:"table-column-group",col:"table-column",thead:"table-header-group",tbody:"table-row-group",tfoot:"table-footer-group",tr:"table-row",td:"table-cell",th:"table-cell"};Z.prototype={get:function(a){return this.store.hasOwnProperty(a)?this.store[a]:null},set:function(a,b){return this.store[a]=b}};var ab={getPosition:function(a){var b=this.positions;return b.get(a)||b.set(a,new ib(this,a))},toString:function(){return"[NodeWrapper("+f.inspectNode(this.node)+")]"}};_.prototype=ab;var bb="EMPTY",cb="NON_SPACE",db="UNCOLLAPSIBLE_SPACE",eb="COLLAPSIBLE_SPACE",fb="TRAILING_SPACE_IN_BLOCK",gb="TRAILING_SPACE_BEFORE_BR",hb="PRE_LINE_TRAILING_SPACE_BEFORE_LINE_BREAK";h(ab,{isCharacterDataNode:$("isCharacterDataNode",f.isCharacterDataNode,"node"),getNodeIndex:$("nodeIndex",f.getNodeIndex,"node"),getLength:$("nodeLength",f.getNodeLength,"node"),containsPositions:$("containsPositions",N,"node"),isWhitespace:$("isWhitespace",V,"node"),isCollapsedWhitespace:$("isCollapsedWhitespace",W,"node"),getComputedDisplay:$("computedDisplay",I,"node"),isCollapsed:$("collapsed",X,"node"),isIgnored:$("ignored",Y,"node"),next:$("nextPos",T,"node"),previous:$("previous",U,"node"),getTextNodeInfo:$("textNodeInfo",function(a){var b=null,c=!1,d=F(a.parentNode,"whiteSpace"),e=d=="pre-line";if(e)b=j,c=!0;else if(d=="normal"||d=="nowrap")b=i,c=!0;return{node:a,text:a.data,spaceRegex:b,collapseSpaces:c,preLine:e}},"node"),hasInnerText:$("hasInnerText",function(a,b){var c=this.session,d=c.getPosition(a.parentNode,this.getNodeIndex()+1),e=c.getPosition(a,0),f=b?d:e,g=b?e:d;while(f!==g){f.prepopulateChar();if(f.isDefinitelyNonEmpty())return!0;f=b?f.previousVisible():f.nextVisible()}return!1},"node"),getTrailingSpace:$("trailingSpace",function(a){if(a.tagName.toLowerCase()=="br")return"";switch(this.getComputedDisplay()){case"inline":var b=a.lastChild;while(b){if(!Y(b))return b.nodeType==1?this.session.getNodeWrapper(b).getTrailingSpace():"";b=b.previousSibling}break;case"inline-block":case"inline-table":case"none":case"table-column":case"table-column-group":break;case"table-cell":return"	";default:return this.hasInnerText(!0)?"\n":""}return""},"node"),getLeadingSpace:$("leadingSpace",function(a){switch(this.getComputedDisplay()){case"inline":case"inline-block":case"inline-table":case"none":case"table-column":case"table-column-group":case"table-cell":break;default:return this.hasInnerText(!1)?"\n":""}return""},"node")});var kb={character:"",characterType:bb,isBr:!1,prepopulateChar:function(){var a=this;if(!a.prepopulatedChar){var b=a.node,c=a.offset,d="",e=bb,f=!1;if(c>0)if(b.nodeType==3){var g=b.data,h=g.charAt(c-1),i=a.nodeWrapper.getTextNodeInfo(),j=i.spaceRegex;i.collapseSpaces?j.test(h)?c>1&&j.test(g.charAt(c-2))||(i.preLine&&g.charAt(c)==="\n"?(d=" ",e=hb):(d=" ",e=eb)):(d=h,e=cb,f=!0):(d=h,e=db,f=!0)}else{var k=b.childNodes[c-1];k&&k.nodeType==1&&!X(k)&&(k.tagName.toLowerCase()=="br"?(d="\n",a.isBr=!0,e=eb,f=!1):a.checkForTrailingSpace=!0);if(!d){var l=b.childNodes[c];l&&l.nodeType==1&&!X(l)&&(a.checkForLeadingSpace=!0)}}a.prepopulatedChar=!0,a.character=d,a.characterType=e,a.isCharInvariant=f}},isDefinitelyNonEmpty:function(){var a=this.characterType;return a==cb||a==db},resolveLeadingAndTrailingSpaces:function(){this.prepopulatedChar||this.prepopulateChar();if(this.checkForTrailingSpace){var a=this.session.getNodeWrapper(this.node.childNodes[this.offset-1]).getTrailingSpace();a&&(this.isTrailingSpace=!0,this.character=a,this.characterType=eb),this.checkForTrailingSpace=!1}if(this.checkForLeadingSpace){var b=this.session.getNodeWrapper(this.node.childNodes[this.offset]).getLeadingSpace();b&&(this.isLeadingSpace=!0,this.character=b,this.characterType=eb),this.checkForLeadingSpace=!1}},getPrecedingUncollapsedPosition:function(a){var b=this,c;while(b=b.previousVisible()){c=b.getCharacter(a);if(c!=="")return b}return null},getCharacter:function(a){function j(){return h||(g=i.getPrecedingUncollapsedPosition(a),h=!0),g}this.resolveLeadingAndTrailingSpaces();if(this.isCharInvariant)return this.character;var b=["character",a.includeSpaceBeforeBr,a.includeBlockContentTrailingSpace,a.includePreLineTrailingSpace].join("_"),c=this.cache.get(b);if(c!==null)return c;var d="",e=this.characterType==eb,f,g,h=!1,i=this;if(e){if(this.character!=" "||!!j()&&!g.isTrailingSpace&&g.character!="\n")if(this.character=="\n"&&this.isLeadingSpace)j()&&g.character!="\n"&&(d="\n");else{f=this.nextUncollapsed();if(f){f.isBr?this.type=gb:f.isTrailingSpace&&f.character=="\n"&&(this.type=fb);if(f.character==="\n"){if(this.type!=gb||!!a.includeSpaceBeforeBr)if(this.type!=fb||!f.isTrailingSpace||!!a.includeBlockContentTrailingSpace)if(this.type!=hb||f.type!=cb||!!a.includePreLineTrailingSpace)this.character==="\n"?f.isTrailingSpace?this.isTrailingSpace||!this.isBr:d="\n":this.character===" "&&(d=" ")}else d=this.character}}}else this.character!=="\n"||!!(f=this.nextUncollapsed())&&!f.isTrailingSpace;return this.cache.set(b,d),d},equals:function(a){return!!a&&this.node===a.node&&this.offset===a.offset},inspect:jb,toString:function(){return this.character}};ib.prototype=kb,h(kb,{next:$("nextPos",function(a){var b=a.nodeWrapper,c=a.node,d=a.offset,e=b.session;if(!c)return null;var f,g,h;return d==b.getLength()?(f=c.parentNode,g=f?b.getNodeIndex()+1:0):b.isCharacterDataNode()?(f=c,g=d+1):(h=c.childNodes[d],e.getNodeWrapper(h).containsPositions()?(f=h,g=0):(f=c,g=d+1)),f?e.getPosition(f,g):null}),previous:$("previous",function(a){var b=a.nodeWrapper,c=a.node,d=a.offset,e=b.session,g,h,i;return d==0?(g=c.parentNode,h=g?b.getNodeIndex():0):b.isCharacterDataNode()?(g=c,h=d-1):(i=c.childNodes[d-1],e.getNodeWrapper(i).containsPositions()?(g=i,h=f.getNodeLength(i)):(g=c,h=d-1)),g?e.getPosition(g,h):null}),nextVisible:$("nextVisible",function(a){var b=a.next();if(!b)return null;var c=b.nodeWrapper,d=b.node,e=b;return c.isCollapsed()&&(e=c.session.getPosition(d.parentNode,c.getNodeIndex()+1)),e}),nextUncollapsed:$("nextUncollapsed",function(a){var b=a;while(b=b.nextVisible()){b.resolveLeadingAndTrailingSpaces();if(b.character!=="")return b}return null}),previousVisible:$("previousVisible",function(a){var b=a.previous();if(!b)return null;var c=b.nodeWrapper,d=b.node,e=b;return c.isCollapsed()&&(e=c.session.getPosition(d.parentNode,c.getNodeIndex())),e})});var lb=null,mb=function(){function a(a){var b=new Z;return{get:function(c){var d=b.get(c[a]);if(d)for(var e=0,f;f=d[e++];)if(f.node===c)return f;return null},set:function(c){var d=c.node[a],e=b.get(d)||b.set(d,[]);e.push(c)}}}function c(){this.initCaches()}var b=g.isHostProperty(document.documentElement,"uniqueID");return c.prototype={initCaches:function(){this.elementCache=b?function(){var a=new Z;return{get:function(b){return a.get(b.uniqueID)},set:function(b){a.set(b.node.uniqueID,b)}}}():a("tagName"),this.textNodeCache=a("data"),this.otherNodeCache=a("nodeName")},getNodeWrapper:function(a){var b;switch(a.nodeType){case 1:b=this.elementCache;break;case 3:b=this.textNodeCache;break;default:b=this.otherNodeCache}var c=b.get(a);return c||(c=new _(a,this),b.set(c)),c},getPosition:function(a,b){return this.getNodeWrapper(a).getPosition(b)},getRangeBoundaryPosition:function(a,b){var c=b?"start":"end";return this.getPosition(a[c+"Container"],a[c+"Offset"])},detach:function(){this.elementCache=this.textNodeCache=this.otherNodeCache=null}},c}();h(f,{nextNode:T,previousNode:U});var rb=Array.prototype.indexOf?function(a,b){return a.indexOf(b)}:function(a,b){for(var c=0,d=a.length;c<d;++c)if(a[c]===b)return c;return-1};h(a.rangePrototype,{moveStart:zb(!0,!1),moveEnd:zb(!1,!1),move:zb(!0,!0),trimStart:Ab(!0),trimEnd:Ab(!1),trim:yb(function(a,b){var c=this.trimStart(b),d=this.trimEnd(b);return c||d}),expand:yb(function(a,b,c){var f=!1;c=w(c,C);var g=y(c.characterOptions);b||(b=d);if(b==e){var h=x(c.wordOptions),i=a.getRangeBoundaryPosition(this,!0),j=a.getRangeBoundaryPosition(this,!1),k=sb(i,g,h),l=k.nextEndToken(),m=l.chars[0].previousVisible(),n,o;if(this.collapsed)n=l;else{var p=sb(j,g,h);n=p.previousStartToken()}return o=n.chars[n.chars.length-1],m.equals(i)||(this.setStart(m.node,m.offset),f=!0),o&&!o.equals(j)&&(this.setEnd(o.node,o.offset),f=!0),c.trim&&(c.trimStart&&(f=this.trimStart(g)||f),c.trimEnd&&(f=this.trimEnd(g)||f)),f}return this.moveEnd(d,1,c)}),text:yb(function(a,b){return this.collapsed?"":vb(a,this,y(b)).join("")}),selectCharacters:yb(function(a,b,c,d,e){var f={characterOptions:e};b||(b=this.getDocument().body),this.selectNodeContents(b),this.collapse(!0),this.moveStart("character",c,f),this.collapse(!0),this.moveEnd("character",d-c,f)}),toCharacterRange:yb(function(a,b,c){b||(b=this.getDocument().body);var d=b.parentNode,e=f.getNodeIndex(b),g=f.comparePoints(this.startContainer,this.endContainer,d,e)==-1,h=this.cloneRange(),i,j;return g?(h.setStartAndEnd(this.startContainer,this.startOffset,d,e),i=-h.text(c).length):(h.setStartAndEnd(d,e,this.startContainer,this.startOffset),i=h.text(c).length),j=i+this.text(c).length,new E(i,j)}),findText:yb(function(b,c,d){d=w(d,A),d.wholeWordsOnly&&(d.wordOptions=x(d.wordOptions),d.wordOptions.includeTrailingSpace=!1);var e=o(d.direction),f=d.withinRange;f||(f=a.createRange(),f.selectNodeContents(this.getDocument()));var g=c,h=!1;typeof g=="string"?d.caseSensitive||(g=g.toLowerCase()):h=!0;var i=b.getRangeBoundaryPosition(this,!e),j=f.comparePoint(i.node,i.offset);j===-1?i=b.getRangeBoundaryPosition(f,!0):j===1&&(i=b.getRangeBoundaryPosition(f,!1));var k=i,l=!1,m;for(;;){m=xb(k,g,h,f,d);if(m){if(m.valid)return this.setStartAndEnd(m.startPos.node,m.startPos.offset,m.endPos.node,m.endPos.offset),!0;k=e?m.startPos:m.endPos}else{if(!d.wrap||!!l)return!1;f=f.cloneRange(),k=b.getRangeBoundaryPosition(f,!e),f.setBoundary(i.node,i.offset,e),l=!0}}}),pasteHtml:function(a){this.deleteContents();if(a){var b=this.createContextualFragment(a),c=b.lastChild;this.insertNode(b),this.collapseAfter(c)}}}),h(a.selectionPrototype,{expand:yb(function(a,b,c){this.changeEachRange(function(a){a.expand(b,c)})}),move:yb(function(a,b,c,d){if(this.focusNode){this.collapse(this.focusNode,this.focusOffset);var e=this.getRangeAt(0);d||(d={}),d.characterOptions=z(d.characterOptions),e.move(b,c,d),this.setSingleRange(e)}}),trimStart:Bb("trimStart"),trimEnd:Bb("trimEnd"),trim:Bb("trim"),selectCharacters:yb(function(b,c,d,e,f,g){var h=a.createRange(c);h.selectCharacters(c,d,e,g),this.setSingleRange(h,f)}),saveCharacterRanges:yb(function(a,b,c){var d=this.getAllRanges(),e=d.length,f=[],g=e==1&&this.isBackward();for(var h=0,i=d.length;h<i;++h)f[h]={range:d[h].toCharacterRange(b,c),backward:g,characterOptions:c};return f}),restoreCharacterRanges:yb(function(b,c,d){this.removeAllRanges();for(var e=0,f=d.length,g,h;e<f;++e)h=d[e],g=a.createRange(c),g.selectCharacters(c,h.range.start,h.range.end,h.characterOptions),this.addRange(g,h.backward)}),text:yb(function(a,b){var c=[];for(var d=0,e=this.rangeCount;d<e;++d)c[d]=this.getRangeAt(d).text(b);return c.join("")})}),a.innerText=function(b,c){var d=a.createRange(b);d.selectNodeContents(b);var e=d.text(c);return d.detach(),e},a.createWordIterator=function(a,b,c){var d=ob();c=w(c,D);var e=y(c.characterOptions),f=x(c.wordOptions),g=d.getPosition(a,b),h=sb(g,e,f),i=o(c.direction);return{next:function(){return i?h.previousStartToken():h.nextEndToken()},dispose:function(){h.dispose(),this.next=function(){}}}},a.noMutation=function(a){var b=ob();a(b),pb()},a.noMutation.createEntryPointFunction=yb,a.textRange={isBlockNode:L,isCollapsedWhitespaceNode:W,createPosition:yb(function(a,b,c){return a.getPosition(b,c)})}})