'use strict'
// Check-side stub, loaded with electron -r: answers the launch dialog of
// decision 0022 with button SKINNED_CHECK_ANSWER and writes its options
// to SKINNED_CHECK_DIALOG. The app's code is unchanged.
const { dialog } = require('electron')
const fs = require('fs')

dialog.showMessageBox = async (...args) => {
  const o = args.find(a => a && Array.isArray(a.buttons))
  fs.writeFileSync(process.env.SKINNED_CHECK_DIALOG, JSON.stringify(o))
  return { response: Number(process.env.SKINNED_CHECK_ANSWER || 0) }
}
