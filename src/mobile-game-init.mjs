import { installMobileGameSupport } from './mobile-game-support.mjs';
installMobileGameSupport({
  "menus": [
    "#titleScreen",
    "#modalActions"
  ],
  "controls": [
    "#joystick",
    ".touch-actions"
  ]
});
