import type { BatteryDetail, InverterDetail, InverterDevice } from '../types';

// The Inverter view reads Solar Assistant devices as named metric maps
// (`pv_power`, `state_of_charge`…), the same field names the monitor's poller
// turns into InverterDetail and BatteryDetail. Mapping them here lets both
// views share one inverter card and one battery card.

function num(device: InverterDevice, key: string): number | null {
  const v = device.metrics[key]?.value;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function text(device: InverterDevice, key: string): string | null {
  const v = device.metrics[key]?.value;
  return v == null || v === '' ? null : String(v);
}

export function toInverterDetail(device: InverterDevice): InverterDetail {
  const n = (k: string) => num(device, k);
  return {
    id: device.id.replace(/^inverter_/i, ''),
    serialNumber: text(device, 'serial_number'),
    deviceMode: text(device, 'device_mode'),
    temperature: n('temperature'),
    busVoltage: n('bus_voltage'),
    systemPowerW: n('system_power'),
    loadPercent: n('load_percent'),
    loadPowerW: n('load_power'),
    loadApparentPowerVa: n('load_apparent_power'),
    maxAcOutputPowerW: n('max_ac_output_power'),
    maxAcOutputApparentPowerVa: n('max_ac_output_apparent_power'),
    acOutputVoltage: n('ac_output_voltage'),
    acOutputFrequency: n('ac_output_frequency'),
    pvPowerW: n('pv_power'),
    pvVoltage: n('pv_voltage'),
    pvCurrent: n('pv_current'),
    batteryVoltage: n('battery_voltage'),
    batteryCurrent: n('battery_current'),
    batteryPowerW: n('battery_power'),
    batteryPowerFromAcW: n('battery_power_from_ac'),
    gridPowerW: n('grid_power'),
    gridVoltage: n('grid_voltage'),
    gridFrequency: n('grid_frequency'),
    generatorPowerW: n('generator_power'),
    generatorVoltage: n('generator_voltage'),
  };
}

export function toBatteryDetail(device: InverterDevice): BatteryDetail {
  const n = (k: string) => num(device, k);
  const cycles = n('cycles');
  return {
    id: device.id.replace(/^battery_/i, ''),
    capacityAh: n('capacity'),
    stateOfChargePercent: n('state_of_charge') ?? n('soc'),
    powerW: n('power'),
    currentA: n('current'),
    voltage: n('voltage'),
    temperature: n('temperature'),
    temperatureMos: n('temperature_mos'),
    temperatureEnv: n('temperature_env'),
    cycles: cycles != null ? Math.round(cycles) : null,
    chargeCapacityAh: n('charge_capacity'),
    cellVoltageHighest: n('cell_voltage_highest'),
    cellVoltageLowest: n('cell_voltage_lowest'),
    cellVoltageImbalance: n('cell_voltage_imbalance'),
    cellTempHighest: n('cell_temp_highest'),
    cellTempLowest: n('cell_temp_lowest'),
    cellTempAverage: n('cell_temp_average'),
  };
}
