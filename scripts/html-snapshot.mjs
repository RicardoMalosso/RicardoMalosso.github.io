// Safe inside an inert application/json script element, including user-supplied lyrics.
export const serializeSnapshot = value => JSON.stringify(value).replaceAll('<', '\\u003c');
