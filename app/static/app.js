const diagnoseForm = document.getElementById("diagnose-form");
const problemInput = document.getElementById("problem");
const diagnoseButton = document.getElementById("diagnose-button");
const formMessage = document.getElementById("form-message");
const diagnosisResult = document.getElementById("diagnosis-result");
const incidentsBody = document.getElementById("incidents-body");
const historyMessage = document.getElementById("history-message");

let incidentsCache = [];
let currentFilter = "all";
let searchedIncident = null;

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { ...options.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail || `Request failed: ${response.status}`);
    }
    return data;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function setMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
    element.classList.toggle("success", Boolean(message) && !isError);
}

async function checkHealth() {
    const dot = document.getElementById("health-dot");
    const text = document.getElementById("health-text");
    const value = document.getElementById("system-status-value");
    const note = document.getElementById("system-status-note");
    try {
        await apiRequest("/health");
        dot.className = "status-dot online";
        text.textContent = "Local API online";
        value.textContent = "Online";
        value.className = "status-value online-text";
        note.textContent = "AWS tools available in EC2 and Monitoring";
    } catch {
        dot.className = "status-dot offline";
        text.textContent = "Local API unavailable";
        value.textContent = "Unavailable";
        value.className = "status-value offline-text";
        note.textContent = "Check the FastAPI server";
    } 
}

function updateStats(incidents) {
    const openCount = incidents.filter(item => item.status === "Open").length;
    const resolvedCount = incidents.filter(item => item.status === "Resolved").length;
    document.getElementById("total-count").textContent = incidents.length;
    document.getElementById("open-count").textContent = openCount;
    document.getElementById("resolved-count").textContent = resolvedCount;
    document.getElementById("filter-all-count").textContent = incidents.length;
    document.getElementById("filter-open-count").textContent = openCount;
    document.getElementById("filter-resolved-count").textContent = resolvedCount;
}

function getFilteredIncidents() {
    if (searchedIncident) return [searchedIncident];
    if (currentFilter === "open") {
        return incidentsCache.filter(item => item.status === "Open");
    }
    if (currentFilter === "resolved") {
        return incidentsCache.filter(item => item.status === "Resolved");
    }
    return incidentsCache;
}

function renderIncidents(incidents) {
    if (!incidents.length) {
        const label = searchedIncident ? "No matching incident found." :
            currentFilter === "open" ? "No open incidents." :
            currentFilter === "resolved" ? "No resolved incidents." : "No incidents found.";
        incidentsBody.innerHTML = `<tr><td colspan="6" class="empty-state">${label}</td></tr>`;
        return;
    }

    incidentsBody.innerHTML = incidents.map(incident => {
        const statusClass = incident.status === "Resolved" ? "resolved" : "open";
        const action = incident.status === "Open"
            ? `<button class="resolve-button" data-action="resolve" data-id="${Number(incident.id)}">Resolve</button>`
            : `<span class="subtle">Resolved</span>`;
        return `<tr>
            <td>${Number(incident.id)}</td>
            <td>${escapeHTML(incident.problem)}</td>
            <td><span class="pill">${escapeHTML(incident.category)}</span></td>
            <td><span class="pill ${statusClass}">${escapeHTML(incident.status)}</span></td>
            <td>${escapeHTML(incident.created_at)}</td>
            <td>${action}</td>
        </tr>`;
    }).join("");
}

function renderCurrentIncidents() {
    renderIncidents(getFilteredIncidents());
    document.querySelectorAll("[data-filter]").forEach(button => {
        button.classList.toggle("active", button.dataset.filter === currentFilter);
        if (button.classList.contains("stat-card")) {
            button.setAttribute("aria-pressed", String(button.dataset.filter === currentFilter));
        }
    });
}

async function loadIncidents() {
    try {
        const data = await apiRequest("/incidents");
        incidentsCache = Array.isArray(data.incidents) ? data.incidents : [];
        updateStats(incidentsCache);
        renderCurrentIncidents();
        if (!historyMessage.classList.contains("error")) {
            setMessage(historyMessage, "");
        }
    } catch (error) {
        setMessage(historyMessage, `Could not load incidents: ${error.message}`, true);
        incidentsBody.innerHTML = `<tr><td colspan="6" class="empty-state">Could not load incidents.</td></tr>`;
    }
}

function renderDiagnosis(data) {
    const steps = (data.troubleshooting_steps || []).map(step => `<li>${escapeHTML(step)}</li>`).join("");
    const commands = (data.suggested_commands || []).length
        ? data.suggested_commands.map(command => `<code class="command">${escapeHTML(command)}</code>`).join("")
        : "<p class='subtle'>No command suggested for this category.</p>";
    diagnosisResult.innerHTML = `<div class="result-card">
        <div class="result-meta">
            <span class="pill">Incident #${Number(data.incident_id)}</span>
            <span class="pill">${escapeHTML(data.category)}</span>
            <span class="pill open">${escapeHTML(data.status)}</span>
        </div>
        <h3>Diagnosis result</h3>
        <p><strong>Reported problem:</strong> ${escapeHTML(data.reported_problem)}</p>
        <p><strong>Possible cause:</strong> ${escapeHTML(data.possible_cause)}</p>
        <h4>Suggested troubleshooting steps</h4><ol>${steps}</ol>
        <h4>Suggested commands</h4>${commands}
        <p class="subtle">${escapeHTML(data.note)}</p>
    </div>`;
    diagnosisResult.hidden = false;
}

function showView(viewName) {
    const knownViews = ["overview", "incidents", "ec2", "monitoring", "networking", "kubernetes", "security"];
    const view = knownViews.includes(viewName) ? viewName : "overview";
    document.querySelectorAll("[data-view-panel]").forEach(panel => {
        panel.classList.toggle("active", panel.dataset.viewPanel === view);
    });
    document.querySelectorAll(".nav-item").forEach(button => {
        const active = button.dataset.view === view;
        button.classList.toggle("active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
    const titles = {
        overview: "Overview", incidents: "Incident Management", ec2: "EC2 Explorer",
        monitoring: "Monitoring", networking: "Networking", kubernetes: "Kubernetes",
        security: "Security & Cost"
    };
    document.getElementById("page-title").textContent = titles[view];
    if (view === "incidents") renderCurrentIncidents();
    if (view === "ec2") loadEc2Instances();
    if (view === "monitoring") loadCloudWatchStatus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadEc2Instances() {
    const refreshButton = document.getElementById("ec2-refresh-button");
    const status = document.getElementById("ec2-connection-status");
    const region = document.getElementById("ec2-region");
    const count = document.getElementById("ec2-count");
    const message = document.getElementById("ec2-message");
    const tableBody = document.getElementById("ec2-instances-body");

    refreshButton.disabled = true;
    status.textContent = "Connecting…";
    region.textContent = "—";
    count.textContent = "—";
    setMessage(message, "Loading EC2 inventory…");
    tableBody.innerHTML = `
        <tr><td colspan="4" class="empty-state">Loading instances…</td></tr>
    `;

    try {
        const data = await apiRequest("/aws/ec2/instances");

        region.textContent = data.region || "Unknown";
        count.textContent = Number(data.total ?? 0);

        const instances = Array.isArray(data.instances) ? data.instances : [];

        if (instances.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        No EC2 instances were returned for this region.
                    </td>
                </tr>
            `;
            setMessage(message, "AWS connection successful. No instances found in this region.");
        } else {
            tableBody.innerHTML = instances.map(instance => `
                <tr>
                    <td>${escapeHTML(instance.instance_id || "—")}</td>
                    <td>
                        <span class="pill ${
                            instance.state === "running" ? "resolved" : "neutral"
                        }">${escapeHTML(instance.state || "Unknown")}</span>
                    </td>
                    <td>${escapeHTML(instance.instance_type || "—")}</td>
                    <td>${escapeHTML(instance.availability_zone || "—")}</td>
                </tr>
            `).join("");

            setMessage(message, `Loaded ${instances.length} EC2 instance(s) successfully.`);
        }

        status.textContent = "Connected";
    } catch (error) {
        status.textContent = "Unavailable";
        setMessage(message, `Could not load EC2 inventory: ${error.message}`, true);

        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    EC2 inventory could not be loaded. Check the API and AWS permissions.
                </td>
            </tr>
        `;
    } finally {
        refreshButton.disabled = false;
    }
}

document.getElementById("ec2-refresh-button").addEventListener(
    "click",
    loadEc2Instances
);

document.getElementById("cw-refresh-button").addEventListener(
    "click",
    loadCloudWatchStatus
);

document.getElementById("cpu-load-button").addEventListener(
    "click",
    loadCpuMetrics
);


async function loadCloudWatchStatus() {
    const refreshButton = document.getElementById("cw-refresh-button");
    const status = document.getElementById("cw-connection-status");
    const region = document.getElementById("cw-region");
    const alarmCount = document.getElementById("cw-alarm-count");
    const metricCount = document.getElementById("cw-metric-count");
    const message = document.getElementById("cw-message");
    const tableBody = document.getElementById("cw-alarms-body");

    refreshButton.disabled = true;
    status.textContent = "Connecting…";
    region.textContent = "—";
    alarmCount.textContent = "—";
    metricCount.textContent = "—";

    setMessage(message, "Loading CloudWatch monitoring data…");

    tableBody.innerHTML = `
        <tr><td colspan="3" class="empty-state">
            Loading alarms…
        </td></tr>
    `;

    try {
        const data = await apiRequest("/aws/cloudwatch/status");

        region.textContent = data.region || "Unknown";
        alarmCount.textContent = Number(data.alarm_count ?? 0);
        metricCount.textContent = Number(data.ec2_cpu_metric_count ?? 0);

        const alarms = Array.isArray(data.alarms) ? data.alarms : [];

        if (alarms.length === 0) {
            tableBody.innerHTML = `
                <tr><td colspan="3" class="empty-state">
                    No CloudWatch alarms are configured in this region.
                </td></tr>
            `;
        } else {
            tableBody.innerHTML = alarms.map(alarm => {
                const state = String(alarm.state || "Unknown");
                const stateClass = state === "OK"
                    ? "resolved"
                    : state === "ALARM"
                        ? "open"
                        : "";

                return `
                    <tr>
                        <td>${escapeHTML(alarm.name || "—")}</td>
                        <td><span class="pill ${stateClass}">
                            ${escapeHTML(state)}
                        </span></td>
                        <td>${escapeHTML(alarm.reason || "—")}</td>
                    </tr>
                `;
            }).join("");
        }

        status.textContent = "Connected";

        const metricNote = data.ec2_cpu_metrics_available
            ? `${data.ec2_cpu_metric_count} matching EC2 CPU metric definition(s) found.`
            : "No matching EC2 CPU metric definitions found.";

        setMessage(
            message,
            `CloudWatch connected. ${alarms.length} alarm(s). ${metricNote}`
        );
    } catch (error) {
        status.textContent = "Unavailable";

        setMessage(
            message,
            `Could not load CloudWatch data: ${error.message}`,
            true
        );

        tableBody.innerHTML = `
            <tr><td colspan="3" class="empty-state">
                CloudWatch data could not be loaded. Check AWS authentication
                and permissions, then refresh.
            </td></tr>
        `;
    } finally {
        refreshButton.disabled = false;
    }
}


function renderCpuChart(datapoints) {
    const container = document.getElementById("cpu-chart-container");

    const validPoints = datapoints
        .filter(point =>
            Number.isFinite(Number(point.average_cpu_percent)) &&
            Number(point.average_cpu_percent) >= 0 &&
            Number(point.average_cpu_percent) <= 100
        )
        .map(point => ({
            timestamp: point.timestamp,
            cpu: Number(point.average_cpu_percent)
        }));

    if (validPoints.length === 0) {
        container.innerHTML =
            "<p>No valid CPU measurements are available to chart.</p>";
        return;
    }

    const width = 720;
    const height = 280;
    const left = 55;
    const right = 20;
    const top = 25;
    const bottom = 45;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const points = validPoints.map((point, index) => {
        const x = validPoints.length === 1
            ? left + plotWidth / 2
            : left + index * plotWidth / (validPoints.length - 1);

        const y = top + plotHeight - (point.cpu / 100) * plotHeight;

        return { ...point, x, y };
    });

    const grid = [0, 25, 50, 75, 100].map(value => {
        const y = top + plotHeight - (value / 100) * plotHeight;

        return `
            <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"
                  stroke="currentColor" opacity="0.15" />
            <text x="${left - 10}" y="${y + 4}" text-anchor="end"
                  fill="currentColor" font-size="11">${value}%</text>
        `;
    }).join("");

    const line = points.map(point =>
        `${point.x},${point.y}`
    ).join(" ");

    const circles = points.map(point => `
        <circle cx="${point.x}" cy="${point.y}" r="4"
                fill="#2878e5">
            <title>${escapeHTML(point.timestamp)}: ${point.cpu}% CPU</title>
        </circle>
    `).join("");

    const firstLabel = escapeHTML(points[0].timestamp);
    const lastLabel = escapeHTML(points[points.length - 1].timestamp);

    container.innerHTML = `
        <h3>CPU utilization over time</h3>
        <p>Average CPU utilization (%) · Older measurements on the left</p>
        <div style="width:100%; overflow-x:auto;">
            <svg viewBox="0 0 ${width} ${height}"
                 role="img"
                 aria-label="CPU utilization line chart"
                 style="width:100%; min-width:320px; height:auto;">
                ${grid}
                <polyline points="${line}"
                          fill="none"
                          stroke="#2878e5"
                          stroke-width="3"
                          stroke-linejoin="round"
                          stroke-linecap="round" />
                ${circles}
                <text x="${left}" y="${height - 12}"
                      fill="currentColor" font-size="10">${firstLabel}</text>
                <text x="${width - right}" y="${height - 12}"
                      text-anchor="end"
                      fill="currentColor" font-size="10">${lastLabel}</text>
            </svg>
        </div>
    `;
}



async function loadCpuMetrics() {
    const instanceInput = document.getElementById("cpu-instance-id");
    const hoursInput = document.getElementById("cpu-hours");
    const loadButton = document.getElementById("cpu-load-button");
    const message = document.getElementById("cpu-message");
    const tableBody = document.getElementById("cpu-metrics-body");

    const instanceId = instanceInput.value.trim();
    const hours = Number(hoursInput.value);

    // Validate the instance ID before calling the backend.
    if (!/^i-[a-fA-F0-9]+$/.test(instanceId)) {
        setMessage(
            message,
            "Enter a valid EC2 instance ID, such as i-0123456789abcdef0.",
            true
        );
        tableBody.innerHTML =
            '<tr><td colspan="2">No measurements loaded.</td></tr>';
        return;
    }

    // Only allow the time ranges offered by the dropdown.
    if (![1, 3, 6, 12, 24].includes(hours)) {
        setMessage(message, "Select a valid time range.", true);
        return;
    }

    loadButton.disabled = true;
    loadButton.textContent = "Loading...";
    setMessage(message, "Loading CPU measurements...");

    tableBody.innerHTML =
        '<tr><td colspan="2">Loading measurements...</td></tr>';

    try {
        const data = await apiRequest(
            `/aws/cloudwatch/cpu/${encodeURIComponent(instanceId)}?hours=${hours}`
        );

        const datapoints = Array.isArray(data.datapoints)
            ? data.datapoints
            : [];
            
        document.getElementById("cpu-chart-container").innerHTML = "";

        if (datapoints.length === 0) {
            setMessage(
                message,
                data.message ||
                    "No CPU measurements are available for this instance and time range."
            );

            tableBody.innerHTML =
                '<tr><td colspan="2">No CPU measurements available.</td></tr>';
            return;
        }
        renderCpuChart(datapoints);
        tableBody.innerHTML = datapoints.map(point => `
            <tr>
                <td>${escapeHTML(point.timestamp)}</td>
                <td>${escapeHTML(String(point.average_cpu_percent))}%</td>
            </tr>
        `).join("");

        setMessage(
            message,
            `Retrieved ${datapoints.length} CPU measurement(s) for ${data.instance_id} in ${data.region}.`
        );
    } catch (error) {
        document.getElementById("cpu-chart-container").innerHTML = "";
        setMessage(
            message,
            `Could not load CPU measurements: ${error.message}`,
            true
        );

        tableBody.innerHTML =
            '<tr><td colspan="2">Unable to retrieve measurements.</td></tr>';
    } finally {
        loadButton.disabled = false;
        loadButton.textContent = "Load CPU Metrics";
    }
}



document.addEventListener("click", event => {
    const navTarget = event.target.closest("[data-view]");
    if (navTarget) {
        event.preventDefault();
        showView(navTarget.dataset.view);
        return;
    }
    const filterTarget = event.target.closest("[data-filter]");
    if (filterTarget) {
        currentFilter = filterTarget.dataset.filter;
        searchedIncident = null;
        document.getElementById("incident-id").value = "";
        setMessage(historyMessage, "");
        renderCurrentIncidents();
        showView("incidents");
    }
});

diagnoseForm.addEventListener("submit", async event => {
    event.preventDefault();
    diagnoseButton.disabled = true;
    diagnoseButton.textContent = "Diagnosing…";
    diagnosisResult.hidden = true;
    setMessage(formMessage, "");
    try {
        const data = await apiRequest("/diagnose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem: problemInput.value })
        });
        renderDiagnosis(data);
        problemInput.value = "";
        setMessage(formMessage, "Incident diagnosed and saved successfully.");
        currentFilter = "all";
        searchedIncident = null;
        await loadIncidents();
    } catch (error) {
        setMessage(formMessage, error.message, true);
    } finally {
        diagnoseButton.disabled = false;
        diagnoseButton.textContent = "⌕ Diagnose Incident";
    }
});

async function searchIncident(event) {
    event.preventDefault();
    const id = document.getElementById("incident-id").value;
    if (!id || Number(id) < 1 || !Number.isInteger(Number(id))) {
        setMessage(historyMessage, "Enter a valid positive incident ID.", true);
        return;
    }
    setMessage(historyMessage, "");
    try {
        searchedIncident = await apiRequest(`/incidents/${encodeURIComponent(id)}`);
        currentFilter = "all";
        renderCurrentIncidents();
        setMessage(historyMessage, `Showing incident #${searchedIncident.id}.`);
    } catch (error) {
        searchedIncident = null;
        renderIncidents([]);
        setMessage(historyMessage, error.message, true);
    }
}

document.getElementById("search-form").addEventListener("submit", searchIncident);

async function resetIncidentView() {
    document.getElementById("incident-id").value = "";
    searchedIncident = null;
    currentFilter = "all";
    setMessage(historyMessage, "");
    await loadIncidents();
}

document.getElementById("clear-search").addEventListener("click", resetIncidentView);
document.getElementById("refresh-button").addEventListener("click", loadIncidents);
document.getElementById("history-refresh-button").addEventListener("click", loadIncidents);

incidentsBody.addEventListener("click", async event => {
    const button = event.target.closest("[data-action='resolve']");
    if (!button) return;
    const id = button.dataset.id;
    button.disabled = true;
    try {
        await apiRequest(`/incidents/${id}/resolve`, { method: "PATCH" });
        searchedIncident = null;
        setMessage(historyMessage, `Incident #${id} resolved successfully.`);
        await loadIncidents();
    } catch (error) {
        setMessage(historyMessage, error.message, true);
        button.disabled = false;
    }
});

checkHealth();
loadIncidents();
