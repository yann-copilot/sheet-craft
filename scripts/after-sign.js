const { execSync } = require('child_process')
const path = require('path')

exports.default = async function afterSign({ appOutDir, packager }) {
  const appName = packager.appInfo.productName
  const appPath = path.join(appOutDir, `${appName}.app`)
  console.log(`Ad-hoc signing: ${appPath}`)
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
}
