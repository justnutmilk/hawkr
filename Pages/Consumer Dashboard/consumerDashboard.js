document.addEventListener('keydown', (event) => {
  // Check for Command key (metaKey) on Mac or Control key (ctrlKey) on others
  const isModifierKeyPressed = event.metaKey || event.ctrlKey;
  // Check if the 'k' key was pressed
  const isKeyKPressed = event.key === 'k';

  if (isModifierKeyPressed && isKeyKPressed) {
    event.preventDefault(); // Prevent default browser behavior (e.g., focusing the address bar)
    alert('Command + K or Ctrl + K shortcut pressed!');
    // Add your desired function call here
    // e.g., openSearchModal();
  }
});

document.addEventListener ("DOMContentLoaded", function (){
  var searchInput = document.getElementById ("searchInput");

  document.addEventListener ("keydown", function (e){
    if (!searchInput){
      return;
    }

    var isTypingField = false;
    var targetTag = "";
    var isEditable = false;

    if (e.target && e.target.tagName){
      targetTag = e.target.tagName.toLowerCase ();
      isEditable = (e.target.isContentEditable === true);
    }

    if (targetTag === "input" || targetTag === "textarea" || isEditable){
      isTypingField = true;
    }

    if (isTypingField){
      return;
    }

    var pressedKey = "";
    if (e.key){
      pressedKey = e.key.toLowerCase ();
    }

    var isKPressed = (pressedKey === "k");
    var isShortcutPressed = (e.ctrlKey || e.metaKey);

    if (isKPressed && isShortcutPressed){
      e.preventDefault ();
      searchInput.focus ();
      searchInput.select (); // optional
    }
  });
});
