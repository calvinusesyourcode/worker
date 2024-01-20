import child_process from 'child_process';

let init_time = Date.now()
child_process.execSync(`node compute.js`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf-8',
    shell: true
})
const js_time = Date.now() - init_time

init_time = Date.now()
child_process.execSync(`python compute.py`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf-8',
    shell: true
})
const py_time = Date.now() - init_time
console.log(`js: ${js_time}ms`)
console.log(`py: ${py_time}ms`)
