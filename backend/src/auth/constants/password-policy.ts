export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 50;
export const PASSWORD_POLICY_REGEX = /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
export const PASSWORD_POLICY_MESSAGE =
  'La contrasena debe incluir mayuscula, minuscula y al menos un numero o simbolo';

