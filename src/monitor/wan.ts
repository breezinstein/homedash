import type { OpnsenseInterfaceStats, OpnsenseSnapshot } from '../types';

export interface ActiveWanSaturation {
  wan: OpnsenseInterfaceStats | undefined;
  wanInBps: number | null;
  wanOutBps: number | null;
  wanBits: number;
  capacityBps: number;
  percent: number;
}

/**
 * Active-WAN uplink saturation: the active default-gateway's own traffic vs
 * its negotiated link speed. Falls back to the aggregate links (or 1 Gbps)
 * only if the active WAN's line rate is unknown. Shared by the OPNsense top
 * card and the Network tab so both gauges can never drift apart.
 */
export function activeWanSaturation(opnsense: OpnsenseSnapshot): ActiveWanSaturation {
  const wan = opnsense.wanInterfaces?.find((i) => i.active);
  const wanInBps = wan?.inBps ?? null;
  const wanOutBps = wan?.outBps ?? null;
  const wanBits = ((wanInBps ?? 0) + (wanOutBps ?? 0)) * 8;
  const wanCapacity = wan?.speedBps ?? null;
  const capacityBps = wanCapacity && wanCapacity > 0
    ? wanCapacity
    : (opnsense.totalLinkCapacityBps || 1e9);
  const percent = wanBits > 0 ? Math.min(100, (wanBits / capacityBps) * 100) : 0;
  return { wan, wanInBps, wanOutBps, wanBits, capacityBps, percent };
}
