# Why the baseline is 1G SFP

The starting point is a practical stereo optical replacement. A 10G link is an option for aggregation and high channel counts, not the minimum consumer requirement.

A 1000BASE-X link runs at 1.25 GBd and supplies a 1.000 Gb/s MAC service after line coding. The v0.2 calculations use that service rate once; they do not deduct 8b/10b again.

For PCM32 or packed DSD32, a packet carries `P = 4CG` audio bytes for `C` channels and `G` groups. Packet grouping is limited by a 1,440-byte payload cap and a 125 µs target. The occupied rate adds the 12-byte O2AT header, Ethernet envelope, optional tag, FCS, preamble and inter-frame gap, including minimum padding for short frames.

At stereo PCM32/3.072 MHz, the tagged occupied rate is 203.9808 Mb/s. Eight channels at that same rate use 815.9232 Mb/s. That passes the draft’s 85% direct-link policy ceiling, but not an 80% ceiling. Sixteen channels exceed the 1G MAC service and require a higher-capacity profile.

Those figures describe transport capacity. They do not certify a DAC, host interface, optical module or switch, and capacity admission does not guarantee queueing delay. Each endpoint must advertise only formats it can buffer and deliver.
