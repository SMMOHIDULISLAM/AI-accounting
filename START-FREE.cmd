@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=3002
set AI_ACCOUNTING_EDITION=whatsapp
echo এআই হিসাব - বিনামূল্যে স্থানীয় সংস্করণ
echo এই উইন্ডো খোলা রাখুন। বন্ধ করতে Ctrl+C চাপুন।
echo অ্যাপের ঠিকানা: http://127.0.0.1:3002/whatsapp
node --env-file-if-exists=.env --import tsx server/index.ts --production --local
pause

