// store/useStoreSync listens for this event and reloads the branches / financial years of the top bar.
export const announceContextChange = () => window.dispatchEvent(new Event('globalContextUpdated'));
