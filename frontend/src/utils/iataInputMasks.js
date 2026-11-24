/**
 * IATA Strict Input Masking
 * Replaces non-permitted characters and forces uppercase.
 * Permitted: A-Z, 0-9, Space, Hyphen (-), Dot (.)
 */
export const applyIataMask = (value) => {
    if (!value) return '';
    return value.toUpperCase().replace(/[^A-Z0-9 \-.]/g, '');
};

export const iataChangeHandler = (setter) => (e) => {
    setter(applyIataMask(e.target.value));
};
