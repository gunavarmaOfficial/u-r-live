/**
 * Warms the /live route chunk when the user shows intent (hover or keyboard
 * focus on a "Start" control), so the camera screen opens without a stall.
 */
export function preloadLivePage() {
  void import('../pages/LivePage');
}
