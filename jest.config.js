module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // node | jsdom
  snapshotSerializers: [],
  setupFiles: ['./test/setup.js']
}
