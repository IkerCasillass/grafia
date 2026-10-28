/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'widget',
  name: 'GrafiaWidget',
  displayName: 'Grafía',
  // Controls (Control Center, Action button) need iOS 18.
  deploymentTarget: '18.0',
});
