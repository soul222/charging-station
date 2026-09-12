import os
import json
from typing import Optional, Dict, Any

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "usb_ports_config.json")

DEFAULT_MAPPINGS = {
    "Port_#0002": {"connector_id": 1, "label": "Port USB 1 (Kiri) - AC Type 2"},
    "Port_#0003": {"connector_id": 2, "label": "Port USB 2 (Kanan) - DC CHAdeMO"},
    "Port_#0004": {"connector_id": 3, "label": "Port USB 3 (Type-C) - CCS2"}
}

class PortMapper:
    @classmethod
    def load_config(cls) -> Dict[str, Any]:
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        # If not exists or invalid, write defaults
        cls.save_config(DEFAULT_MAPPINGS)
        return DEFAULT_MAPPINGS

    @classmethod
    def save_config(cls, data: Dict[str, Any]):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass

    @staticmethod
    def extract_port_key(location_info: str) -> str:
        """
        Normalize 'Port_#0002.Hub_#0001' to 'Port_#0002'
        """
        if not location_info:
            return ""
        parts = location_info.split(".")
        return parts[0].strip()

    @classmethod
    def get_device_port_by_serial(cls, serial_no: str) -> Optional[str]:
        """
        Search Windows Registry HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USB
        for an instance matching the device serial number.
        Returns the raw LocationInformation string (e.g. 'Port_#0002.Hub_#0001') or None.
        """
        if not serial_no:
            return None

        try:
            import winreg
            base = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Enum\USB")
            num_subkeys = winreg.QueryInfoKey(base)[0]

            for i in range(num_subkeys):
                sub = winreg.EnumKey(base, i)
                sub_key = winreg.OpenKey(base, sub)
                num_inst = winreg.QueryInfoKey(sub_key)[0]

                for j in range(num_inst):
                    inst = winreg.EnumKey(sub_key, j)
                    # Check if serial matches instance name
                    if serial_no.lower() in inst.lower():
                        inst_key = winreg.OpenKey(sub_key, inst)
                        try:
                            loc = winreg.QueryValueEx(inst_key, "LocationInformation")[0]
                            return loc
                        except Exception:
                            pass
        except Exception:
            pass
        return None

    @classmethod
    def get_connector_id_for_port(cls, location_info: str) -> Optional[int]:
        """
        Maps a location info (e.g. 'Port_#0002.Hub_#0001') to a connector_id (1, 2, or 3).
        """
        if not location_info:
            return None
        
        config = cls.load_config()
        port_key = cls.extract_port_key(location_info)

        # 1. Exact match on port_key (e.g. 'Port_#0002')
        if port_key in config:
            entry = config[port_key]
            return entry.get("connector_id") if isinstance(entry, dict) else entry

        # 2. Exact match on full location_info
        if location_info in config:
            entry = config[location_info]
            return entry.get("connector_id") if isinstance(entry, dict) else entry

        # 3. Dynamic fallback: extract trailing port number if available
        # e.g. Port_#0002 -> 2, Port_#0001 -> 1
        try:
            if "Port_#" in port_key:
                num_str = port_key.replace("Port_#", "").lstrip("0")
                num = int(num_str) if num_str else 1
                if 1 <= num <= 3:
                    return num
        except Exception:
            pass

        return None

    @classmethod
    def set_port_mapping(cls, port_key: str, connector_id: int, label: Optional[str] = None):
        config = cls.load_config()
        clean_key = cls.extract_port_key(port_key) or port_key
        config[clean_key] = {
            "connector_id": connector_id,
            "label": label or f"Nozzle {connector_id}"
        }
        cls.save_config(config)

    @classmethod
    def get_all_mappings(cls) -> Dict[str, Any]:
        return cls.load_config()
