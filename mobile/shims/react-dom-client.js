function createRoot() {
  return {
    render() {},
    unmount() {},
  };
}

module.exports = {
  createRoot,
  default: {
    createRoot,
  },
};
