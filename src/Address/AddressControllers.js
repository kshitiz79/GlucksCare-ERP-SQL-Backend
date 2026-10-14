const os = require('os');
const crypto = require('crypto');

let activeStressBuffers = [];
let releaseTimeout = null;

exports.createAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const address = await Address.create(req.body);

        res.status(201).json({
            success: true,
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAllAddresses = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const addresses = await Address.findAll();

        res.status(200).json({
            success: true,
            data: addresses
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAddressById = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        res.status(200).json({
            success: true,
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        await address.update(req.body);

        res.status(200).json({
            success: true,
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        await address.destroy();

        res.status(200).json({
            success: true,
            message: 'Address deleted successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.setDefaultOriginAddress = async (req, res) => {
    try {
        const { Address } = req.app.get('models');
        const { id } = req.params;

        const address = await Address.findByPk(id);

        if (!address) {
            return res.status(404).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Set all addresses' is_default_origin to false
        await Address.update({ is_default_origin: false }, { where: {} });

        // Set this address's is_default_origin to true
        await address.update({ is_default_origin: true });

        res.status(200).json({
            success: true,
            message: 'Default origin address set successfully',
            data: address
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Controller to get current Node.js and OS CPU/RAM metrics
 */
exports.getSystemMetrics = (req, res) => {
    try {
        const mem = process.memoryUsage();
        const toMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        res.status(200).json({
            success: true,
            data: {
                processMemory: {
                    rss: toMb(mem.rss),
                    heapTotal: toMb(mem.heapTotal),
                    heapUsed: toMb(mem.heapUsed),
                    external: toMb(mem.external),
                    arrayBuffers: toMb(mem.arrayBuffers || 0)
                },
                systemMemory: {
                    total: toMb(totalMem),
                    free: toMb(freeMem),
                    used: toMb(usedMem),
                    usagePercent: `${((usedMem / totalMem) * 100).toFixed(2)}%`
                },
                cpu: {
                    cores: os.cpus().length,
                    model: os.cpus()[0]?.model || 'Unknown',
                    loadAverage1m: os.loadavg()[0],
                    loadAverage5m: os.loadavg()[1],
                    loadAverage15m: os.loadavg()[2]
                },
                activeStressAllocatedMb: toMb(activeStressBuffers.reduce((acc, b) => acc + b.length, 0)),
                uptimeSeconds: Math.floor(process.uptime())
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Controller to trigger controlled CPU and/or RAM load testing for VPS monitoring verification
 * Query or Body params:
 * - memoryMb: Amount of RAM to allocate in MB (e.g. 500, 1000)
 * - holdSeconds: Number of seconds to hold allocated memory before auto-release (default: 15s, max: 300s)
 * - cpuDurationMs: Duration to burn CPU in milliseconds (e.g. 3000, 5000, max: 30000ms)
 */
exports.runStressTest = (req, res) => {
    try {
        const params = { ...req.query, ...req.body };
        const requestedMemoryMb = parseInt(params.memoryMb || 0, 10);
        const requestedCpuDurationMs = parseInt(params.cpuDurationMs || 0, 10);
        const requestedHoldSeconds = parseInt(params.holdSeconds || 15, 10);

        // Safe bounds to prevent irrecoverable kernel crash
        const memoryMb = Math.max(0, requestedMemoryMb);
        const cpuDurationMs = Math.min(Math.max(0, requestedCpuDurationMs), 30000);
        const holdSeconds = Math.min(Math.max(1, requestedHoldSeconds), 300);

        let allocatedBytes = 0;

        // 1. RAM Stress: Allocate buffers and touch memory pages
        if (memoryMb > 0) {
            if (releaseTimeout) {
                clearTimeout(releaseTimeout);
                releaseTimeout = null;
            }
            activeStressBuffers = [];

            const chunkSize = 25 * 1024 * 1024; // 25 MB chunks
            const totalBytes = memoryMb * 1024 * 1024;
            let current = 0;

            while (current < totalBytes) {
                const size = Math.min(chunkSize, totalBytes - current);
                // Fill buffer so OS allocates real physical RAM pages instead of virtual zero-pages
                const buf = Buffer.alloc(size, 0xaa);
                activeStressBuffers.push(buf);
                current += size;
                allocatedBytes += size;
            }

            // Auto-release memory after specified seconds
            releaseTimeout = setTimeout(() => {
                activeStressBuffers = [];
                releaseTimeout = null;
                if (global.gc) {
                    try { global.gc(); } catch (e) {}
                }
            }, holdSeconds * 1000);
        }

        // 2. CPU Stress: Burn CPU for specified milliseconds
        let cpuCycles = 0;
        let cpuTimeTaken = 0;
        if (cpuDurationMs > 0) {
            const start = Date.now();
            let seed = 'gluckscare-stress-test-token';
            while (Date.now() - start < cpuDurationMs) {
                seed = crypto.createHash('sha256').update(seed).digest('hex');
                cpuCycles++;
            }
            cpuTimeTaken = Date.now() - start;
        }

        const mem = process.memoryUsage();
        const toMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

        res.status(200).json({
            success: true,
            message: 'Load/stress test executed successfully',
            summary: {
                allocatedRam: toMb(allocatedBytes),
                memoryHoldSeconds: memoryMb > 0 ? holdSeconds : 0,
                autoReleaseNotice: memoryMb > 0 
                    ? `Allocated memory will automatically be freed in ${holdSeconds} seconds. Call /api/addresses/stress-test/release to free immediately.`
                    : 'No memory requested',
                cpuDurationMs: cpuTimeTaken,
                cpuCyclesExecuted: cpuCycles
            },
            currentSystemState: {
                processRss: toMb(mem.rss),
                processHeapUsed: toMb(mem.heapUsed),
                systemMemoryFree: toMb(os.freemem()),
                systemMemoryTotal: toMb(os.totalmem()),
                systemLoadAvg1m: os.loadavg()[0]
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Controller to manually release any active stress-test memory buffers immediately
 */
exports.releaseStressMemory = (req, res) => {
    try {
        if (releaseTimeout) {
            clearTimeout(releaseTimeout);
            releaseTimeout = null;
        }
        const freedBytes = activeStressBuffers.reduce((acc, b) => acc + b.length, 0);
        activeStressBuffers = [];
        if (global.gc) {
            try { global.gc(); } catch (e) {}
        }

        const toMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

        res.status(200).json({
            success: true,
            message: 'Stress test memory released successfully',
            freedRam: toMb(freedBytes)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

