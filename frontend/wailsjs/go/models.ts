export namespace main {
	
	export class AppEntry {
	    name: string;
	    path: string;
	    size: number;
	    bundle_id: string;
	
	    static createFrom(source: any = {}) {
	        return new AppEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.bundle_id = source["bundle_id"];
	    }
	}
	export class BatteryInfo {
	    percent: number;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new BatteryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.percent = source["percent"];
	        this.status = source["status"];
	    }
	}
	export class CPUMetrics {
	    usage: number;
	    per_core: number[];
	    num_cores: number;
	
	    static createFrom(source: any = {}) {
	        return new CPUMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.usage = source["usage"];
	        this.per_core = source["per_core"];
	        this.num_cores = source["num_cores"];
	    }
	}
	export class CommandResult {
	    success: boolean;
	    output: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new CommandResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.output = source["output"];
	        this.error = source["error"];
	    }
	}
	export class DevCacheResult {
	    id: string;
	    success: boolean;
	    freed: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new DevCacheResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.success = source["success"];
	        this.freed = source["freed"];
	        this.error = source["error"];
	    }
	}
	export class DevCacheTool {
	    id: string;
	    name: string;
	    available: boolean;
	    size_bytes: number;
	
	    static createFrom(source: any = {}) {
	        return new DevCacheTool(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.available = source["available"];
	        this.size_bytes = source["size_bytes"];
	    }
	}
	export class DiskEntry {
	    name: string;
	    path: string;
	    size: number;
	    is_dir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DiskEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.is_dir = source["is_dir"];
	    }
	}
	export class DiskMetrics {
	    path: string;
	    total: number;
	    used: number;
	    free: number;
	    used_percent: number;
	
	    static createFrom(source: any = {}) {
	        return new DiskMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.total = source["total"];
	        this.used = source["used"];
	        this.free = source["free"];
	        this.used_percent = source["used_percent"];
	    }
	}
	export class HostInfo {
	    hostname: string;
	    os: string;
	    platform: string;
	    platform_version: string;
	    kernel_version: string;
	    uptime_seconds: number;
	
	    static createFrom(source: any = {}) {
	        return new HostInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.os = source["os"];
	        this.platform = source["platform"];
	        this.platform_version = source["platform_version"];
	        this.kernel_version = source["kernel_version"];
	        this.uptime_seconds = source["uptime_seconds"];
	    }
	}
	export class KillProcessResult {
	    pid: number;
	    name: string;
	    success: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new KillProcessResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.name = source["name"];
	        this.success = source["success"];
	        this.message = source["message"];
	    }
	}
	export class LogEntry {
	    name: string;
	    path: string;
	    size: number;
	    mod_time: number;
	    is_dir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.mod_time = source["mod_time"];
	        this.is_dir = source["is_dir"];
	    }
	}
	export class MemoryMetrics {
	    total: number;
	    used: number;
	    available: number;
	    used_percent: number;
	
	    static createFrom(source: any = {}) {
	        return new MemoryMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.used = source["used"];
	        this.available = source["available"];
	        this.used_percent = source["used_percent"];
	    }
	}
	export class NetworkMetrics {
	    bytes_sent_per_sec: number;
	    bytes_recv_per_sec: number;
	
	    static createFrom(source: any = {}) {
	        return new NetworkMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bytes_sent_per_sec = source["bytes_sent_per_sec"];
	        this.bytes_recv_per_sec = source["bytes_recv_per_sec"];
	    }
	}
	export class NodeModulesEntry {
	    project_name: string;
	    project_path: string;
	    path: string;
	    size: number;
	    mod_time: number;
	
	    static createFrom(source: any = {}) {
	        return new NodeModulesEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_name = source["project_name"];
	        this.project_path = source["project_path"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.mod_time = source["mod_time"];
	    }
	}
	export class ProcessDetail {
	    pid: number;
	    name: string;
	    cpu: number;
	    memory: number;
	    status: string;
	    runtime: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.name = source["name"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	        this.status = source["status"];
	        this.runtime = source["runtime"];
	    }
	}
	export class ProcessInfo {
	    name: string;
	    cpu: number;
	    memory: number;
	
	    static createFrom(source: any = {}) {
	        return new ProcessInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	    }
	}
	export class SystemMetrics {
	    cpu: CPUMetrics;
	    memory: MemoryMetrics;
	    disk: DiskMetrics;
	    network: NetworkMetrics;
	    host: HostInfo;
	    battery: BatteryInfo;
	    top_processes: ProcessInfo[];
	
	    static createFrom(source: any = {}) {
	        return new SystemMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpu = this.convertValues(source["cpu"], CPUMetrics);
	        this.memory = this.convertValues(source["memory"], MemoryMetrics);
	        this.disk = this.convertValues(source["disk"], DiskMetrics);
	        this.network = this.convertValues(source["network"], NetworkMetrics);
	        this.host = this.convertValues(source["host"], HostInfo);
	        this.battery = this.convertValues(source["battery"], BatteryInfo);
	        this.top_processes = this.convertValues(source["top_processes"], ProcessInfo);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UpdateInfo {
	    has_update: boolean;
	    latest_version: string;
	    current_version: string;
	    release_url: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.has_update = source["has_update"];
	        this.latest_version = source["latest_version"];
	        this.current_version = source["current_version"];
	        this.release_url = source["release_url"];
	    }
	}
	export class WatchedProcess {
	    pid: number;
	    name: string;
	    cpu: number;
	    memory: number;
	    status: string;
	    command: string;
	
	    static createFrom(source: any = {}) {
	        return new WatchedProcess(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.name = source["name"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	        this.status = source["status"];
	        this.command = source["command"];
	    }
	}

}

