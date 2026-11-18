// What counts as a phone. Narrow screens, plus phones on their side: those are
// wide but too short for the desktop board or the scaled takeovers. Mirrors
// useResponsive().isMobile; the CSS spells the same two queries out by hand.
export const PHONE_QUERY = '(max-width: 768px), (max-height: 500px) and (max-width: 1024px)';
export const WIDE_QUERY = '(min-width: 769px) and (min-height: 501px), (min-width: 1025px)';
