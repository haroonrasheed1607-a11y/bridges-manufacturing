const stateDirectory = ".netlify/version-state";
module.exports = {
  async onPreBuild({ utils }) {
    await utils.cache.restore(stateDirectory);
  },
  async onPostBuild({ utils }) {
    await utils.cache.save(stateDirectory);
  },
};
