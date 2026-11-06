/* Definicje typów urządzeń, połączeń i statusów (ikony rysowane w siatce 24×24). */
window.HL = window.HL || {};

HL.CATEGORIES = [
  { id: 'wan', label: 'Internet / WAN' },
  { id: 'network', label: 'Sieć' },
  { id: 'security', label: 'Bezpieczeństwo' },
  { id: 'servers', label: 'Serwery i storage' },
  { id: 'virtual', label: 'Wirtualizacja' },
  { id: 'endpoints', label: 'Urządzenia końcowe' },
  { id: 'infra', label: 'Infrastruktura' }
];

HL.DEVICE_TYPES = {
  /* --- WAN --- */
  internet: {
    label: 'Internet', cat: 'wan', color: '#38bdf8',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>'
  },
  modem: {
    label: 'Modem / ONT', cat: 'wan', color: '#0ea5e9',
    icon: '<rect x="3" y="12" width="18" height="7" rx="1.5"/><path d="M7 12V6M17 12V4"/><circle class="f" cx="7" cy="15.5" r="1"/><circle class="f" cx="10.5" cy="15.5" r="1"/><path d="M14 15.5h3.5"/>'
  },
  cloud: {
    label: 'Usługa chmurowa', cat: 'wan', color: '#60a5fa',
    icon: '<path d="M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.6 4.5 4.5 0 0 0 7 18.5z"/><path d="M12 16v-4.5M10 13.5l2-2 2 2"/>'
  },

  /* --- Sieć --- */
  router: {
    label: 'Router', cat: 'network', color: '#3b82f6',
    icon: '<rect x="3" y="13" width="18" height="6.5" rx="1.5"/><path d="M7 13 5.5 6.5M17 13l1.5-6.5"/><circle class="f" cx="7" cy="16.3" r="1"/><circle class="f" cx="10.3" cy="16.3" r="1"/><path d="M14 16.3h3.5"/>'
  },
  switch: {
    label: 'Switch', cat: 'network', color: '#6366f1',
    icon: '<rect x="2" y="8" width="20" height="8.5" rx="1.5"/><rect x="4.5" y="11" width="2.4" height="2.4"/><rect x="8.5" y="11" width="2.4" height="2.4"/><rect x="12.5" y="11" width="2.4" height="2.4"/><rect x="16.5" y="11" width="2.4" height="2.4"/>'
  },
  ap: {
    label: 'Access Point', cat: 'network', color: '#06b6d4',
    icon: '<circle class="f" cx="12" cy="17" r="1.6"/><path d="M8.5 13.5a5 5 0 0 1 7 0"/><path d="M5.3 10.3a9.5 9.5 0 0 1 13.4 0"/><path d="M2.5 7.2a13.5 13.5 0 0 1 19 0"/>'
  },
  patch: {
    label: 'Patch panel', cat: 'network', color: '#64748b',
    icon: '<rect x="2" y="8.5" width="20" height="7" rx="1"/><rect x="4.3" y="10.8" width="2.2" height="2.4"/><rect x="8.1" y="10.8" width="2.2" height="2.4"/><rect x="11.9" y="10.8" width="2.2" height="2.4"/><rect x="15.7" y="10.8" width="2.2" height="2.4"/><path d="M19.6 12h0.1"/>'
  },

  /* --- Bezpieczeństwo --- */
  firewall: {
    label: 'Firewall', cat: 'security', color: '#ef4444',
    icon: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19"/>'
  },
  vpn: {
    label: 'Brama VPN', cat: 'security', color: '#f43f5e',
    icon: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/><rect x="9.3" y="11" width="5.4" height="4.2" rx=".8"/><path d="M10.5 11V9.6a1.5 1.5 0 0 1 3 0V11"/>'
  },

  /* --- Serwery i storage --- */
  server: {
    label: 'Serwer', cat: 'servers', color: '#10b981',
    icon: '<rect x="4" y="3" width="16" height="5.2" rx="1"/><rect x="4" y="9.4" width="16" height="5.2" rx="1"/><rect x="4" y="15.8" width="16" height="5.2" rx="1"/><circle class="f" cx="7" cy="5.6" r=".9"/><circle class="f" cx="7" cy="12" r=".9"/><circle class="f" cx="7" cy="18.4" r=".9"/><path d="M11 5.6h6M11 12h6M11 18.4h6"/>'
  },
  hypervisor: {
    label: 'Hypervisor', cat: 'servers', color: '#22c55e',
    icon: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5l9 4.5 9-4.5"/>'
  },
  nas: {
    label: 'NAS', cat: 'servers', color: '#14b8a6',
    icon: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8M8 10h8M8 13.5h8"/><circle class="f" cx="9" cy="18" r=".9"/><circle class="f" cx="12" cy="18" r=".9"/>'
  },
  minipc: {
    label: 'Mini PC', cat: 'servers', color: '#34d399',
    icon: '<rect x="4" y="7.5" width="16" height="9" rx="2"/><circle class="f" cx="7.5" cy="12" r="1"/><path d="M11 12h6M8 19.5h8"/>'
  },
  sbc: {
    label: 'Raspberry Pi / SBC', cat: 'servers', color: '#84cc16',
    icon: '<rect x="6" y="6" width="12" height="12" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>'
  },

  /* --- Wirtualizacja --- */
  vm: {
    label: 'Maszyna wirtualna', cat: 'virtual', color: '#8b5cf6',
    icon: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><rect x="6.5" y="7.5" width="11" height="6" stroke-dasharray="2 1.6"/><path d="M8.5 21h7M12 17v4"/>'
  },
  container: {
    label: 'Kontener', cat: 'virtual', color: '#a855f7',
    icon: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>'
  },
  cluster: {
    label: 'Klaster / K8s', cat: 'virtual', color: '#7c3aed',
    icon: '<path d="M12 2.8l7 3.4 1.7 7.5-4.8 6.1H8.1l-4.8-6.1L5 6.2z"/><circle cx="12" cy="12" r="2.6"/><path d="M12 5.6v3.8M12 14.6v3.6M6.2 10.4l3.3.9M14.5 12.7l3.3.9"/>'
  },

  /* --- Urządzenia końcowe --- */
  pc: {
    label: 'Komputer PC', cat: 'endpoints', color: '#f59e0b',
    icon: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20.5h8M12 16v4.5"/>'
  },
  laptop: {
    label: 'Laptop', cat: 'endpoints', color: '#fbbf24',
    icon: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M2.8 18.5h18.4L19.3 15H4.7z"/>'
  },
  phone: {
    label: 'Smartfon / tablet', cat: 'endpoints', color: '#fb923c',
    icon: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'
  },
  tv: {
    label: 'TV / Media', cat: 'endpoints', color: '#f472b6',
    icon: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M9 21l3-4 3 4"/>'
  },
  printer: {
    label: 'Drukarka', cat: 'endpoints', color: '#e879f9',
    icon: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><rect x="7" y="14" width="10" height="7"/>'
  },
  camera: {
    label: 'Kamera IP', cat: 'endpoints', color: '#fb7185',
    icon: '<path d="M3 7.5l12.5-2 1.3 7-12.5 2z"/><path d="M16.3 9.5l4.2-1.2.6 3.4-4.2.9"/><path d="M8 14l1 5H5"/>'
  },
  iot: {
    label: 'IoT / Smart home', cat: 'endpoints', color: '#facc15',
    icon: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="12" cy="15" r="2.2"/><path d="M8.9 11.9a4.4 4.4 0 0 1 6.2 0"/>'
  },

  /* --- Infrastruktura --- */
  ups: {
    label: 'UPS', cat: 'infra', color: '#eab308',
    icon: '<rect x="3" y="7" width="16" height="10" rx="1.5"/><path d="M21 10.5v3"/><path d="M12 8.8l-2.6 3.6h3.2L10 16"/>'
  },
  pdu: {
    label: 'Listwa / PDU', cat: 'infra', color: '#ca8a04',
    icon: '<rect x="2" y="9" width="20" height="6" rx="1.5"/><circle cx="6" cy="12" r="1.2"/><circle cx="10" cy="12" r="1.2"/><circle cx="14" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'
  },
  rack: {
    label: 'Szafa rack', cat: 'infra', color: '#a8a29e',
    icon: '<rect x="5" y="2.5" width="14" height="19" rx="1"/><path d="M5 7h14M5 11.5h14M5 16h14"/><circle class="f" cx="8" cy="4.8" r=".7"/><circle class="f" cx="8" cy="9.3" r=".7"/><circle class="f" cx="8" cy="13.8" r=".7"/>'
  },
  generic: {
    label: 'Inne urządzenie', cat: 'infra', color: '#94a3b8',
    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v5"/><circle class="f" cx="12" cy="16" r="1"/>'
  }
};

HL.LINK_TYPES = {
  ethernet: { label: 'Ethernet (miedź)', color: '#94a3b8', dash: '' },
  fiber: { label: 'Światłowód / SFP / DAC', color: '#f97316', dash: '' },
  wifi: { label: 'Wi-Fi', color: '#22d3ee', dash: '6 5' },
  vpn: { label: 'VPN / tunel', color: '#c084fc', dash: '12 6' },
  virtual: { label: 'Wirtualne (bridge / vSwitch)', color: '#8b5cf6', dash: '2 5' },
  usb: { label: 'USB / szeregowe', color: '#4ade80', dash: '8 3 2 3' },
  power: { label: 'Zasilanie', color: '#facc15', dash: '1 5' }
};

HL.SPEEDS = ['', '100M', '1G', '2.5G', '5G', '10G', '25G', '40G', '100G'];
HL.SPEED_WIDTH = { '': 2, '100M': 1.5, '1G': 2, '2.5G': 2.6, '5G': 3, '10G': 3.6, '25G': 4.2, '40G': 4.8, '100G': 5.4 };

HL.STATUSES = {
  online: { label: 'Online', color: '#22c55e' },
  offline: { label: 'Offline', color: '#ef4444' },
  maintenance: { label: 'Serwis', color: '#f59e0b' },
  planned: { label: 'Planowane', color: '#94a3b8' }
};
