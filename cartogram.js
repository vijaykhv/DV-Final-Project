// Mapping of state names to their abbreviations
const stateAbbreviations = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH",
    "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN",
    "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
};

Promise.all([
    d3.json("us-states.geojson"), // GeoJSON file with state boundaries
    d3.csv("estimated_crimes_1979_2019.csv") // Crime data CSV
]).then(([geoData, crimeData]) => {
    console.log("GeoData:", geoData);
    console.log("CrimeData:", crimeData);

    const width = 800;
    const height = 600;

    const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);

    const svg = d3.select("#cartogram")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("margin", "0 auto")
        .style("display", "block");

    let isPlaying = false;
    let intervalId;
    let hoveredState = null; // Track the currently hovered state

    const playButton = d3.select("#controls")
        .append("button")
        .attr("id", "playPauseButton")
        .text("Play");

    // Process data
    crimeData.forEach(d => {
        d.year = +d.year;
        d.population = +d.population || 0;
        d.violent_crime_rate = d.population ? (d.violent_crime / d.population) * 100000 : 0;
        d.property_crime_rate = d.population ? (d.property_crime / d.population) * 100000 : 0;
        d.rape_legacy_rate = d.population ? (d.rape_legacy / d.population) * 100000 : 0;
        d.aggravated_assault_rate = d.population ? (d.aggravated_assault / d.population) * 100000 : 0;
        d.robbery_rate = d.population ? (d.robbery / d.population) * 100000 : 0;
        d.burglary_rate = d.population ? (d.burglary / d.population) * 100000 : 0;
        d.larceny_rate = d.population ? (d.larceny / d.population) * 100000 : 0;
        d.motor_vehicle_theft_rate = d.population ? (d.motor_vehicle_theft / d.population) * 100000 : 0;
        d.homicide_rate = d.population ? (d.homicide / d.population) * 100000 : 0;
    });

    const years = Array.from(new Set(crimeData.map(d => d.year))).sort();

    let selectedYear = years[0];
    let selectedTrend = "violent_crime_rate";

    function showTooltip(event, d) {
        d3.select(".tooltip").remove();

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("padding", "8px")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("border-radius", "4px")
            .style("pointer-events", "none");

        if (event) {
            tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 20}px`);
        } else {
            const centroid = path.centroid(d);
            const svgBox = svg.node().getBoundingClientRect();
            tooltip.style("left", `${svgBox.left + centroid[0] + 10}px`)
                .style("top", `${svgBox.top + centroid[1] - 20}px`);
        }

        tooltip.html(`
            <strong>${d.properties.name}</strong><br>
            ${selectedTrend.replace(/_/g, " ").toUpperCase()}: ${d.properties.crimeRate.toFixed(2)}<br>
            Population: ${d.properties.population.toLocaleString()}
        `);
    }

    function updateCartogram() {
        const filteredData = crimeData.filter(d => d.year === selectedYear);
    
        geoData.features.forEach(feature => {
            const stateData = filteredData.find(d => d.state_name === feature.properties.name);
            feature.properties.crimeRate = stateData ? stateData[selectedTrend] || 0 : 0;
            feature.properties.population = stateData ? stateData.population || 0 : 0;
        });
    
        const colorScale = d3.scaleSequential(d3.interpolateReds)
            .domain([0, d3.max(geoData.features, d => d.properties.crimeRate)]);
    
        // Render the cartogram paths
        svg.selectAll("path")
            .data(geoData.features)
            .join("path")
            .attr("d", path)
            .attr("fill", d => d.properties.crimeRate > 0 ? colorScale(d.properties.crimeRate) : "#ccc")
            .attr("stroke", "#333")
            .attr("stroke-width", 1)
            .on("mouseover", (event, d) => {
                hoveredState = d; // Update the hovered state
                showTooltip(event, d); // Display tooltip
            })
            .on("mouseout", () => {
                hoveredState = null; // Clear hovered state
                d3.select(".tooltip").remove();
            })
            .on("click", (event, d) => {
                // Add zoom logic for clicked state
                const [[x0, y0], [x1, y1]] = path.bounds(d);
                svg.transition().duration(750).call(
                    d3.zoom()
                        .scaleExtent([1, 8])
                        .transform,
                    d3.zoomIdentity
                        .translate(width / 2, height / 2)
                        .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
                        .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
                );
            });
    
        // Add state labels
        svg.selectAll("text")
            .data(geoData.features)
            .join("text")
            .attr("class", "state-label")
            .attr("x", d => path.centroid(d)[0])
            .attr("y", d => path.centroid(d)[1])
            .text(d => stateAbbreviations[d.properties.name])
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("font-family", "Arial, sans-serif")
            .attr("font-weight", "bold")
            .attr("fill", "black")
            .style("pointer-events", "none");
    
        // Clear any existing legend and create a new one
        svg.select("#cartogram-legend").remove(); // Clear old legend
        createLegend(svg, colorScale); // Add the legend
    }

    function playAnimation() {
        intervalId = setInterval(() => {
            const yearIndex = years.indexOf(selectedYear);
            selectedYear = years[(yearIndex + 1) % years.length];
            d3.select("#yearLabel").text(`Year: ${selectedYear}`);
            updateCartogram();
        }, 100);
    }

    function stopAnimation() {
        clearInterval(intervalId);
    }

    function createLegend(container, colorScale) {
        const legendWidth = 200;
        const legendHeight = 300;
    
        // Clear existing legend
        d3.select("#cartogram-legend").select("svg").remove();
    
        // Create SVG for the legend
        const legendSvg = d3.select("#cartogram-legend")
            .append("svg")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("display", "block");
    
        const legendGroup = legendSvg.append("g")
            .attr("transform", "translate(10, 20)");
    
        // Gradient for the legend
        const defs = legendSvg.append("defs");
        const linearGradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%");
    
        const colorDomain = colorScale.domain();
        const step = 100 / (colorDomain.length - 1);
    
        colorDomain.forEach((d, i) => {
            linearGradient.append("stop")
                .attr("offset", `${i * step}%`)
                .attr("stop-color", colorScale(d));
        });
    
        legendGroup.append("rect")
            .attr("width", 20)
            .attr("height", legendHeight - 40)
            .style("fill", "url(#legend-gradient)");
    
        // Add legend labels
        const legendScale = d3.scaleLinear()
            .domain([colorDomain[0], colorDomain[colorDomain.length - 1]])
            .range([legendHeight - 40, 0]);
    
        const legendAxis = d3.axisRight(legendScale)
            .tickFormat(d3.format(".2s"));
    
        legendGroup.append("g")
            .attr("transform", "translate(20, 0)")
            .call(legendAxis);
    
        // Add title
        legendGroup.append("text")
            .attr("x", 0)
            .attr("y", -10)
            .text("Crime Rate Legend")
            .style("font-size", "14px")
            .style("font-family", "Arial, sans-serif")
            .style("fill", "#A64D79");
    }
    

    playButton.on("click", () => {
        isPlaying = !isPlaying;
        playButton.text(isPlaying ? "Pause" : "Play");

        if (isPlaying) {
            playAnimation();
        } else {
            stopAnimation();
        }
    });

    d3.select("#crimeSelect").on("change", function () {
        selectedTrend = this.value;
        updateCartogram();
    });

    d3.select("#yearSlider")
        .attr("min", 0)
        .attr("max", years.length - 1)
        .attr("value", 0)
        .on("input", function () {
            const yearIndex = +this.value;
            selectedYear = years[yearIndex];
            d3.select("#yearLabel").text(`Year: ${selectedYear}`);
            updateCartogram();
        });
    
    
    updateCartogram(); // Initial render
}).catch(error => console.error("Error loading files:", error));
