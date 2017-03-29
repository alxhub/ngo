import * as fs from 'fs';

const data = fs.readFileSync(process.argv[2]).toString();

for (let i = 0; i < data.length; i++) {
  const char = data.charAt(i);
  if (char === '\n') {
    console.log('newline @ ' + i);
  }
}
