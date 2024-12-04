const width = 900, height = 600; // Map dimensions
const colorScale = d3.scaleOrdinal(d3.schemePastel1); // Light colors for better visualization

let selectedYear = 1979; // Default year
let selectedState = null; // Track selected state

Promise.all([
    d3.json("us-states.geojson"), // GeoJSON file
    d3.csv("estimated_crimes_1979_2019.csv") // Dataset
]).then(([geoData, crimeData]) => {
    const projection = d3.geoAlbersUsa().fitSize([width, height], geoData);
    const path = d3.geoPath().projection(projection);

    const svg = d3.select("#map")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g"); // Group for map and labels

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    crimeData.forEach(d => {
        d.year = +d.year;
        d.population = +d.population || null;
        d.violent_crime_rate = d.population ? (d.violent_crime / d.population) * 100000 : null;
        d.property_crime_rate = d.population ? (d.property_crime / d.population) * 100000 : null;
    });

    const years = Array.from(new Set(crimeData.map(d => d.year))).sort();
    const yearSelect = d3.select("#yearSelect");
    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .text(d => d)
        .attr("value", d => d);

        const lineGraphContainer = d3.select("#lineGraphContainer")
        .append("svg")
        .attr("width", 400)
        .attr("height", 300)
        .style("display", "none"); // Ensure it's hidden initially
    

    const xScale = d3.scaleLinear().range([50, 350]);
    const yScale = d3.scaleLinear().range([250, 50]);

    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(yScale);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.rate));

    lineGraphContainer.append("g").attr("class", "x-axis").attr("transform", "translate(0,250)");
    lineGraphContainer.append("g").attr("class", "y-axis").attr("transform", "translate(50,0)");
    lineGraphContainer.append("path").attr("class", "line violent-crime").attr("fill", "none").attr("stroke", "blue").attr("stroke-width", 2);
    lineGraphContainer.append("path").attr("class", "line property-crime").attr("fill", "none").attr("stroke", "red").attr("stroke-width", 2);

    // Add legend for line chart
    const legend = d3.select("#lineGraphContainer")
        .append("div")
        .attr("class", "legend")
        .style("display", "flex")
        .style("gap", "10px")
        .style("margin", "10px 0");

    legend.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .html('<div style="width: 20px; height: 2px; background: blue; margin-right: 5px;"></div>Violent Crime');

    legend.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .html('<div style="width: 20px; height: 2px; background: red; margin-right: 5px;"></div>Property Crime');

        const updateLineGraph = (stateName) => {
            const stateData = crimeData.filter(d => d.state_name === stateName);
        
            if (stateData.length) {
                const violentCrimeData = stateData.map(d => ({ year: d.year, rate: d.violent_crime_rate }));
                const propertyCrimeData = stateData.map(d => ({ year: d.year, rate: d.property_crime_rate }));
        
                xScale.domain(d3.extent(stateData, d => d.year));
                yScale.domain([0, d3.max([...violentCrimeData, ...propertyCrimeData], d => d.rate)]);
        
                lineGraphContainer.select(".x-axis").call(xAxis);
                lineGraphContainer.select(".y-axis").call(yAxis);
        
                lineGraphContainer.select(".violent-crime")
                    .datum(violentCrimeData)
                    .attr("d", line);
        
                lineGraphContainer.select(".property-crime")
                    .datum(propertyCrimeData)
                    .attr("d", line);
        
                lineGraphContainer.style("display", "block"); // Show the line chart
            } else {
                lineGraphContainer.style("display", "none"); // Hide the line chart if no data exists
            }
        };
        

    function updateDetails(stateName, stateData) {
        d3.select("#stateName").text(stateName);
    
        if (stateData) {
            let detailsHtml = `<p><strong>Year:</strong> ${stateData.year}</p>`;
            Object.entries(stateData).forEach(([key, value]) => {
                if (key !== "year" && key !== "state_name" && key !== "caveats" && key !== "rape_revised") {
                    detailsHtml += `<p><strong>${key.replace(/_/g, " ")}:</strong> ${value?.toLocaleString() || "N/A"}</p>`;
                }
            });
            d3.select("#stateDetails").html(detailsHtml);
            updateLineGraph(stateName);
        } else {
            d3.select("#stateDetails").html(`<p>No data available for ${stateName} in ${selectedYear}.</p>`);
            lineGraphContainer.style("display", "none"); // Hide the line chart when no data is available
        }
    }
    

    function zoomToState(d) {
        const [[x0, y0], [x1, y1]] = path.bounds(d);
        svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
                .translate(width / 2, height / 2)
                .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
                .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
        );
    }

    function addStateAbbreviations() {
        const abbreviationGroup = g.append("g").attr("class", "state-abbreviations");

        abbreviationGroup.selectAll("text")
            .data(geoData.features)
            .enter()
            .append("text")
            .attr("x", d => path.centroid(d)[0])
            .attr("y", d => path.centroid(d)[1])
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .attr("font-size", "10px")
            .attr("font-family", "Arial")
            .attr("fill", "#333")
            .text(d => stateAbbreviations[d.properties.name] || "");
    }

    function updateMap() {
        const filteredData = crimeData.filter(d => d.year === selectedYear);

        geoData.features.forEach(feature => {
            const stateData = filteredData.find(d => d.state_name === feature.properties.name);
            feature.properties.data = stateData || {};
        });

        g.selectAll("path")
            .data(geoData.features)
            .join("path")
            .attr("d", path)
            .attr("fill", (d, i) => colorScale(i))
            .attr("stroke", "#333")
            .attr("stroke-width", 1)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .attr("fill", "orange")
                    .attr("stroke-width", 2);
                d3.select("#stateName").text(d.properties.name);
            })
            .on("mouseout", function (event, d) {
                d3.select(this)
                    .attr("fill", (d, i) => colorScale(i))
                    .attr("stroke-width", 1);
                if (!selectedState) d3.select("#stateName").text("Click on a state");
            })
            .on("click", (event, d) => {
                selectedState = d.properties.name;
                const stateData = d.properties.data;
                updateDetails(selectedState, stateData);
                zoomToState(d);
            });

        addStateAbbreviations();
    }

    yearSelect.on("change", function () {
        selectedYear = +this.value;
        updateMap();

        if (selectedState) {
            const filteredData = crimeData.filter(d => d.year === selectedYear);
            const stateData = filteredData.find(d => d.state_name === selectedState);
            updateDetails(selectedState, stateData);
        }
    });

    d3.select("#resetButton").on("click", () => {
        selectedState = null;
        d3.select("#stateName").text("Click on a state");
        d3.select("#stateDetails").html("Details will appear here.");
        lineGraphContainer.style("display", "none");
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    updateMap();
}).catch(error => console.error("Error loading files:", error));
