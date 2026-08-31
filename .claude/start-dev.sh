#!/bin/sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "/Users/kishoresudhamalla/Desktop/Hanuman_Portfolio folder"
exec npm run dev -- --host
