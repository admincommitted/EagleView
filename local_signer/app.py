r"""
Local DSC Signer - console version (START_SIGNER.bat, port 5050).
16-Nov-2026: the signing code now lives in ..\signer_tool\signer_core.py - one copy for this console signer and for
EagleView Signer (EagleViewSigner.exe, window + tray). The old code of this file is in
backups\signer_tool_20261116\app.py. Fixed there: PDF signing (wrong pyHanko call), JSON signing (invalid CMS),
HYP2003 driver search, browser calls only from the EagleView addresses.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "signer_tool"))
import signer_core  # noqa: E402

app = signer_core.app

if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--probe":
        signer_core.probe_main(sys.argv[2])
        sys.exit(0)
    signer_core.run_console()
