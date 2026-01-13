export const getTranslation = (key, lang) => {
  // Simple fallback translation - can expand later if needed
  const translations = {
    verifyingNetwork: "Checking Network...",
    newDeviceDetected: "New Device Detected",
    oneTimeAuthMessage: "You're at the office but office network IP has changed recently, you're the first client so please authorize one time for all the clients in this network",
    enterPassword: "Enter the Wi-Fi password of Cigro Litmers Endash (1-5) to authorize",
    passwordPlaceholder: "Password...",
    incorrectPassword: "Incorrect password",
    verifying: "Verifying...",
    authorizeDevice: "Authorize Device",
    accessDenied: "Access Denied",
    unauthorizedLocationMessage: "You are not at the office location.",
    unauthorizedDefaultMessage: "You are not authorized to access this page.",
    status: "Status",
    distance: "Distance",
    retry: "Retry",
    unauthorized_location: "Unauthorized Location",
    unauthorized_ip: "Unauthorized IP",
    error: "System Error",
    vibeCodedBy: "Yes, this was 100% vibe-coded by, and is a legacy work of",
    checkAnotherWork: "Check another work — SwaggerNav",
    checkMeetingRooms: "Cigro Meeting Rooms",
    github: "GitHub"
  };
  return translations[key] || key;
};
