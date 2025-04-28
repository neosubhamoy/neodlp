!macro NSIS_HOOK_POSTINSTALL
  ; Add Registry Keys for Chrome Native Messaging Host
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.neosubhamoy.neodlp" "" "$INSTDIR\neodlp-msghost.json"
  ; Add Registry Keys for Firefox Native Messaging Host
  WriteRegStr HKCU "Software\Mozilla\NativeMessagingHosts\com.neosubhamoy.neodlp" "" "$INSTDIR\neodlp-msghost-moz.json"
  ; Add entry for automatic startup with Windows
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}" "$\"$INSTDIR\neodlp.exe$\" --hidden"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove the Registry entries
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.neosubhamoy.neodlp"
  DeleteRegKey HKCU "Software\Mozilla\NativeMessagingHosts\com.neosubhamoy.neodlp"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
!macroend