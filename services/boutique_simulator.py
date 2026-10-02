import asyncio
import random
from datetime import datetime

SERVICES = [
    "frontend", "cartservice", "checkoutservice", "recommendationservice",
    "productcatalogservice", "paymentservice", "shippingservice",
    "emailservice", "currencyservice", "adservice", "loadgenerator"
]

class BoutiqueSimulator:
    def __init__(self):
        self.metrics = {
            svc: {"requests_per_sec": 0, "error_rate": 0.0, "latency_p95_ms": 0}
            for svc in SERVICES
        }
        self.chaos_scenario = None
        self.is_running = False

    def trigger_chaos(self, scenario):
        self.chaos_scenario = scenario
        self.chaos_log_count = 0

    def stop_chaos(self):
        """Stops active failure generation while preserving steady-state failure metric until reset."""
        self.chaos_scenario = None
        self.chaos_log_count = 0

    def reset(self):
        self.chaos_scenario = None
        self.chaos_log_count = 0
        self.generate_baseline_metrics()

    def get_metrics(self):
        return self.metrics

    def generate_baseline_metrics(self):
        for svc in SERVICES:
            base_rps = 100 if svc in ["frontend", "loadgenerator"] else random.randint(20, 80)
            base_latency = random.randint(10, 50)
            
            # Baseline is mostly healthy
            self.metrics[svc]["requests_per_sec"] = base_rps + random.randint(-10, 10)
            self.metrics[svc]["error_rate"] = round(random.uniform(0.0, 0.5), 2)
            self.metrics[svc]["latency_p95_ms"] = base_latency + random.randint(-5, 10)

    def apply_chaos_metrics(self):
        if not self.chaos_scenario:
            return
            
        if self.chaos_scenario == "payment_crash":
            self.metrics["paymentservice"]["error_rate"] = round(random.uniform(80.0, 100.0), 2)
            self.metrics["paymentservice"]["latency_p95_ms"] = random.randint(2000, 5000)
            self.metrics["checkoutservice"]["error_rate"] = round(random.uniform(40.0, 60.0), 2)
            self.metrics["checkoutservice"]["latency_p95_ms"] = random.randint(1000, 2000)
            self.metrics["frontend"]["error_rate"] = round(random.uniform(10.0, 20.0), 2)
            self.metrics["frontend"]["latency_p95_ms"] = random.randint(500, 1500)
            
        elif self.chaos_scenario in ["frontend_spike", "frontend_traffic"]:
            self.metrics["frontend"]["requests_per_sec"] = random.randint(2000, 3000)
            self.metrics["frontend"]["latency_p95_ms"] = random.randint(500, 1500)
            self.metrics["frontend"]["error_rate"] = round(random.uniform(20.0, 40.0), 2)
            self.metrics["cartservice"]["latency_p95_ms"] = random.randint(300, 800)

        elif self.chaos_scenario in ["production_config_drift", "config_drift"]:
            self.metrics["paymentservice"]["error_rate"] = round(random.uniform(65.0, 90.0), 2)
            self.metrics["paymentservice"]["latency_p95_ms"] = random.randint(2500, 4500)
            self.metrics["checkoutservice"]["error_rate"] = round(random.uniform(35.0, 55.0), 2)

        elif self.chaos_scenario == "verification_failure":
            # Controlled failure on paymentservice only
            self.metrics["paymentservice"]["error_rate"] = round(random.uniform(85.0, 95.0), 2)
            self.metrics["paymentservice"]["latency_p95_ms"] = random.randint(3000, 4500)

    async def run(self, log_callback):
        self.is_running = True
        self.chaos_log_count = 0
        while self.is_running:
            self.generate_baseline_metrics()
            self.apply_chaos_metrics()
            
            # Emit standard heartbeat log (without flooding persistent DB audit trail)
            active_svc = random.choice(SERVICES)
            log_callback(active_svc, "HEARTBEAT", f"Service healthy. latency={self.metrics[active_svc]['latency_p95_ms']}ms")
            
            # Only emit failure logs during initial phase of chaos scenario (max 3 times) to avoid infinite spam
            if self.chaos_scenario and getattr(self, 'chaos_log_count', 0) < 3:
                self.chaos_log_count += 1
                if self.chaos_scenario == "payment_crash":
                    log_callback("paymentservice", "ERROR", "FATAL: PaymentService crashed: NullPointerException at payment connector")
                    log_callback("checkoutservice", "ERROR", "Payment failed for OrderID: 503 Service Unavailable API timeout")
                elif self.chaos_scenario in ["frontend_spike", "frontend_traffic"]:
                    log_callback("frontend", "ERROR", "503 Service Unavailable: overloaded, max connections reached")
                elif self.chaos_scenario in ["production_config_drift", "config_drift"]:
                    log_callback("paymentservice", "ERROR", "FATAL: Configuration mismatch or invalid credential drift in paymentservice environment")
                elif self.chaos_scenario == "verification_failure":
                    log_callback("paymentservice", "ERROR", "FATAL: Persistent transaction connector failure in paymentservice cluster")

            # Persist historical metrics and evaluate alarm rules in background
            try:
                from services.history_service import history_service
                from services.alarm_engine import alarm_engine
                
                # Make a snapshot to avoid race conditions
                snapshot = {s: dict(m) for s, m in self.metrics.items()}
                history_service.record_metrics_batch(snapshot)
                alarm_engine.evaluate(snapshot)
            except Exception as e:
                # Never let persistence or alarm errors interrupt the simulator
                pass

            await asyncio.sleep(2)

simulator = BoutiqueSimulator()
