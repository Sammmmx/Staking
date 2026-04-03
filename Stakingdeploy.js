const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const token = "0x212281278FC7f8f99F689Ae80d0269a7A01da08D";

module.exports = buildModule("Stv1", (m) => {
  const staking = m.contract("Staking", [token]);
  return { staking };
});
