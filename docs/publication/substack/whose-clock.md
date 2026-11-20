# Whose clock controls playback?

A packet can arrive early or late without changing the DAC’s conversion cadence, if the receiver architecture separates those clock domains and the FIFO remains within bounds.

Ethernet needs recovered timing to identify symbols and bytes. O2AT uses that transport clock for reception, not as a direct DAC conversion reference. Accepted samples enter a dual-clock FIFO. A receiver-owned audio clock controls reads and conversion.

This removes one direct path from packet arrival variation to conversion timing. It does not eliminate phase noise from the receiver, power-supply coupling, clock-domain crossing risks or underrun behaviour. Those are implementation questions that need measurements.

Credits let the receiver constrain how much data a source may have sent, including packets still in flight. If the source can pace its production, feedback can keep buffer occupancy controlled. A common 10 MHz reference can discipline frequency in a reference-tier system, but it does not establish a common sample epoch.

A live source with an independent fixed-rate clock is different. If its rate differs even slightly and cannot be adjusted, a finite FIFO eventually fills or empties. A 1 ms available margin at 50 ppm corresponds to about 20 seconds in the simplified rate model. It is not a promise about measured hardware because packet phase, delay and reserve also matter.

Clock acquisition, holdover, reference-loss response and mute/recovery behaviour belong in the protocol and test plan. A remote status message cannot be allowed to delay local protection.
