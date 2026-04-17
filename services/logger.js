export function logInfo(message, context = {}) {
  console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), ...context }));
}

export function logWarn(message, context = {}) {
  console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date().toISOString(), ...context }));
}

export function logError(message, context = {}) {
  console.error(JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), ...context }));
}
