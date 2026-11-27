; Extend Tauri's explicit Delete application data choice. Updates always retain data.
!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    ; Optional explicit full-clean switch for scripted uninstall, including CI tests.
    ClearErrors
    ${GetOptions} $CMDLINE "/CLEAN" $R8
    ${IfNot} ${Errors}
      StrCpy $DeleteAppDataCheckboxState 1
    ${EndIf}
    ${If} $DeleteAppDataCheckboxState = 1
      !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
      ClearErrors
      ExecWait '"$INSTDIR\${MAINBINARYNAME}.exe" --cleanup-for-uninstall' $R9
      ${If} ${Errors}
      ${OrIf} $R9 <> 0
        DetailPrint "App cleanup failed; uninstall stopped. Close the app and Roblox Studio, then retry."
        ${IfNot} ${Silent}
          MessageBox MB_OK|MB_ICONSTOP "App cleanup failed. Uninstall stopped so you can retry. Close the app and Roblox Studio, then try again."
        ${EndIf}
        SetErrorLevel 1
        Abort
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
