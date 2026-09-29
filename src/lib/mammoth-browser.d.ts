// Mammoth's prebuilt browser bundle has no declarations of its own, but it
// exposes exactly the same API as the package's main entry, so reuse those.
declare module 'mammoth/mammoth.browser' {
  import mammoth = require('mammoth')
  export = mammoth
}
