# agents/rca_agent.py

def root_cause(log_summary, service):
    """
    RCA Agent utilizing Chain-of-Thought style pseudo-reasoning.
    Finds the root cause given structured logs.
    """
    summary_lower = (log_summary or "").lower()

    if "config" in summary_lower:
        cause = f"Configuration drift or parameter mismatch in {service} component."
    elif "schema" in summary_lower:
        cause = f"Database schema lock or unindexed query bottleneck in {service} component."
    elif "cache" in summary_lower:
        cause = f"Stale cache invalidation or memory cache miss storm in {service} component."
    elif "traffic" in summary_lower or "spike" in summary_lower or "surge" in summary_lower or "rate" in summary_lower:
        cause = f"High incoming traffic volume and concurrency surge in {service} component."
    elif "crash" in summary_lower or "oom" in summary_lower or "nullpointer" in summary_lower:
        cause = f"Pod crash or fatal termination in {service} component."
    else:
        cause = f"Pod failure or high latency in {service} component."

    prompt = f"""
    Think step-by-step:
    1. What failed? The {service} failed due to severe degradation.
    2. What triggered it? Analysis of logs indicates: {log_summary}.
    3. Root cause conclusion: {cause}
    """
    
    return {
        "root_cause": cause,
        "chain_of_thought": prompt,
        "severity": "CRITICAL"
    }
