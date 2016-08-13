var $ = require("jquery");

// Helper Methods
function wrapInRepeatedWordClass(str) {
    return "<span class='repeated-word'>" + str + "</span>";
}

function compressStr(msg) {
    // Simple compression. Adjacent, repeated strings are compressed to one instance
    // followed by "x [n]" where n is the number of times it is repeated.
    var msgArray = msg.split(" ");
    var prevString = msgArray[0];
    var count = 1;
    var newStr = "";
    for (var i = 1; i < msgArray.length; i++) {
        var word = msgArray[i];

        if (prevString === word) {
            count += 1;
        } else {
            if (count === 1) {
                newStr += prevString + " ";
            } else {
                newStr += wrapInRepeatedWordClass(prevString + " x" + count) + " ";
            }
            count = 1;
            prevString = word;
        }
    }
    if (count === 1) {
        newStr += prevString;
    } else {
        newStr += wrapInRepeatedWordClass(prevString + " x" + count);
    }
    return newStr;
}

function compressMessageReadable(chatLine) {
    // Takes a Twitch chat message element and makes a Compakt version.
    // For a message, each node type is handled differently.
    //   1.Text nodes with repeated, consecutive words are replaced with an element
    // showing the word once and a multiplier.
    //   2. Comment nodes are skipped.
    //   3. Repeated, consecutive element nodes are replaced with an element showing
    // the element once next to a multplier equal to the number of times it's shown.

    // Note: we assume if we ever encounter any element nodes that they are
    // Twitch emoticons.

    var prevElement = null;
    var count = 0;

    for (var i = 0; i < chatLine.length; i++) {
        var type = chatLine[i].nodeType;
        
        switch (type)
        {
          //Text Node
          case 3:
          {
            // Text node
            if (chatLine[i].data.trim() === "") {
                // Gotta skip those weird nodes that are not rendered on screen but
                // exist in the HTML doc.
                continue;
            }

            // Replaces repeated, consecutive words with the multiplier element.
            // HTML will be injected here. We assume it's safe because we wrote
            // compressStr().
            var newMsg = compressStr(chatLine[i].data.trim());

            // Replaces text node with element node.
            // IMPORTANT NOTE:
            // We assume that Twitch performs excellent protection from injection
            // and when we are parsing any text nodes, they are SAFE.
            // They are safe because Compakt receives them after Twitch sanitizes them.
            // There could be issues if something changes the text on the DOM (like another
            // extension) before we process it.
            var temp = document.createElement('span');
            temp.innerHTML = newMsg;
            while (temp.firstChild) {
                chatLine[i].parentNode.insertBefore(temp.firstChild, chatLine[i]);
            }
            chatLine[i].parentNode.removeChild(chatLine[i]);
            prevElement = null;
            break;
          }
          
          //Element Node
          case 1:
          {
            var ele = $(chatLine[i]);
            var eleText = ele.text().trim();
            // Node should be an emoticon
            if (prevElement) {
                if (prevElement === eleText) {
                    // This is a repeated element. Remove it.
                    ele.remove();
                    count += 1;
                } else {
                    // The end of a run. (could be a run of length 1!)
                    if (count > 1) {
                        ele.append(" x" + count);
                        ele.addClass("repeated-word");
                    }
                    prevElement = eleText;
                    count = 1;
                }
            } else {
                // This is the first emoticon we see. Set it and continue.
                prevElement = eleText;
                count = 1;
            }
            break;
          }
          
          default:
          prevElement = null;
          break;
        }
    }
}

function removeRepeatedWords(msg) {
    var msgArray = msg.split(" ");
    var prevString = msgArray[0];
    var newStr = "";
    for (var i = 1; i < msgArray.length; i++) {
        var word = msgArray[i];
        if (prevString != word) {
            newStr += prevString + " ";
            prevString = word;
        }
    }
    newStr += prevString;

    return newStr;
}

function makeKeyFromChatMessage(chatLine) {
    // Takes a Twitch chat message element and creates a key.
    // The objective is that the key uniquely identifies this message.
    // For a message, each node type is handled differently.
    // Text nodes have repeated, consecutive words removed.
    // Comment nodes are ignored.
    // Element nodes are checked if they are repeated in series.
    // Note: we assume if we ever encounter any element nodes that they are
    // Twitch emoticons.

    var prevEmote = null;
    var key = "";

    for (var i = 0; i < chatLine.length; i++) {
        var type = chatLine[i].nodeType;
        
        switch (type)
        {       
          //Element Node
          case 1:
          {
            // Element node, should be an emoticon
            // ele.text() should be the Twitch name for the emoticon
            var ele = $(chatLine[i]);
            var emoticonName = ele.text().trim();
            if (prevEmote) {
                if (prevEmote != emoticonName) {
                    key += prevEmote + " ";
                    prevEmote = emoticonName;
                }
            } else {
                prevEmote = emoticonName;
            }
            break;
          }
          
          //Text Node
          case 3:
          {
            // Text node
            var txt = chatLine[i].textContent;
            if (txt.trim() === "") {
                continue;
            }
            var newMsg = removeRepeatedWords(txt.trim());
            key += newMsg + " ";
          }
          
          //All others
          default:
          {
            prevEmote = null;
            break;
          }
        }
    }

    // Lower case it!
    return key.toLowerCase();
}

// Export public functions
module.exports.compressMessageReadable = compressMessageReadable;
module.exports.makeKeyFromChatMessage = makeKeyFromChatMessage;


