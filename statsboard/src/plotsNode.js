import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';
import {HLL, fromHexString} from './js_hll'

export function makePlotsNode(startTime, endTime, node) {

  // show message while loading
  let loadingMsg = document.getElementById("loading-msg");
  loadingMsg.innerHTML = "Loading plots. Please wait...";
  function flashLoadingMessage() {
    if (loadingMsg.innerHTML === "Loading plots. Please wait...") {
      loadingMsg.innerHTML = "Loading plots. Please wait";
    } else {
      loadingMsg.innerHTML += ".";
    }
  }
  const intervalId = setInterval(flashLoadingMessage, 500);

  // make a call to retrieve list of nodes
  fetch('https://ws.resif.fr/eidaws/statistics/1/nodes')
    .then((response) => {
      if (response.ok) {
        return response.json();
      }
      else {
        response.text().then(errorMessage => {
          if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
            let totalplots = document.getElementById('error-total');
            totalplots.innerHTML = "Service is temporarily unavailable. Please try again.";
          }
        });
        throw Error(response.statusText);
      }
    })
    .then((data) => {
      const nodes = data.nodes.map(node => node.name).sort();
      const colors = ["#7eed89", "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf", "#3294b8", "#eb9a49", "#f5ed53", "#291200"];
      let nodesColors = {};
      for (let i = 0; i < nodes.length && i < colors.length; i++) {
        nodesColors[nodes[i]] = colors[i];
      }

      totalPlots();
      monthAndYearPlots("month");
      monthAndYearPlots("year");
      mapPlots();

      function totalPlots() {
        const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}&level=node&hllvalues=true&format=json`;
        fetch(url)
          .then((response) => {
            if (response.ok) {
              return response.json();
            }
            else {
              response.text().then(errorMessage => {
                if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                  let totalplots = document.getElementById('error-total');
                  totalplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                }
                else if (response.status >= 400 && response.status < 500) {
                  let totalplots = document.getElementById('error-total');
                  totalplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                }
              });
              throw Error(response.statusText);
            }
          })
          .then((data) => {
            // rearrange results and colors
            for (const node in nodesColors) {
              if (!data.results.map(result => result.node).includes(node)) {
                delete nodesColors[node];
              }
            }
            const rearrangedResults = data.results.sort((a, b) => {
              return Object.keys(nodesColors).indexOf(a.node) - Object.keys(nodesColors).indexOf(b.node);
            });
            // calculate hll values for total clients all nodes indicator plot
            let hll = new HLL(11, 5);
            data.results.forEach((result) => {
              hll.union(fromHexString(result.hll_clients).hllSet);
            });
            // clients plot, per node pie at first
            const pieDataClients = {
              values: rearrangedResults.map(result => result.clients),
              labels: Object.keys(nodesColors),
              type: 'pie',
              marker: {
                colors: Object.values(nodesColors)
              },
              hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
              sort: false
            };
            const pieLayoutClients = {
              title: 'Total number of unique users*',
              annotations: [
                {
                  x: -0.7,
                  y: -0.3,
                  xref: 'paper',
                  yref: 'paper',
                  text: '*<i>Important note: The number of unique users is correct for each node.<br>However, the whole pie does not represent the real value of the total users for<br>all selected nodes, as many clients may have asked data from multiple nodes.<\i>',
                  showarrow: false,
                  font: {
                    family: 'Arial',
                    size: 12,
                    color: 'black'
                  }
                }
              ],
              updatemenus: [{
                buttons: [
                  // total clients per node pie button
                  {
                    args: [
                      {
                        values: [rearrangedResults.map(result => result.clients)],
                        type: 'pie',
                        sort: false
                      },
                      {
                        title: 'Total number of unique users*',
                        annotations: [
                          {
                            x: -0.7,
                            y: -0.3,
                            xref: 'paper',
                            yref: 'paper',
                            text: '*<i>Important note: The number of unique users is correct for each node.<br>However, the whole pie does not represent the real value of the total users for<br>all selected nodes, as many clients may have asked data from multiple nodes.<\i>',
                            showarrow: false,
                            font: {
                              family: 'Arial',
                              size: 12,
                              color: 'black'
                            }
                          }
                        ]
                      }
                    ],
                    label: 'Unique Users Per Node',
                    method: 'update'
                  },
                  // total clients for all specified nodes indicator button
                  {
                    args: [
                      {
                        type: "indicator",
                        value: hll.cardinality(),
                        mode: "number",
                        number: { font: { size: 50 } }
                      },
                      {
                        title: 'Total number of unique users of all specified nodes',
                        annotations: []
                      }
                    ],
                    label: 'Unique Users All Nodes',
                    method: 'update'
                  }
                ],
                direction: 'down',
                type: 'buttons'
              }]
            };
            Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, {displaylogo: false});

            // bytes plot
            const pieDataBytes = {
              values: rearrangedResults.map(result => result.bytes),
              labels: Object.keys(nodesColors),
              type: 'pie',
              marker: {
                colors: Object.values(nodesColors)
              },
              hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
              sort: false
            };
            const pieLayoutBytes = {
              title: 'Total number of bytes'
            };
            Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, {displaylogo: false});

            // requests plot
            // show total requests at first
            const pieDataRequests = {
              values: rearrangedResults.map(result => result.nb_reqs),
              labels: Object.keys(nodesColors),
              type: 'pie',
              marker: {
                colors: Object.values(nodesColors)
              },
              hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
              sort: false
            };
            const pieLayoutRequests = {
              title: 'Total number of requests',
              updatemenus: [{
                buttons: [
                  // total requests button
                  {
                    args: [
                      {
                        values: [rearrangedResults.map(result => result.nb_reqs)],
                        type: 'pie',
                        sort: false
                      },
                      {
                        title: 'Total number of requests'
                      }
                    ],
                    label: 'Total Requests',
                    method: 'update'
                  },
                  // successful requests button
                  {
                    args: [
                      {
                        values: [rearrangedResults.map(result => result.nb_successful_reqs)],
                        type: 'pie',
                        sort: false
                      },
                      {
                        title: 'Total number of successful requests'
                      }
                    ],
                    label: 'Successful Requests',
                    method: 'update'
                  },
                  // unsuccessful requests button
                  {
                    args: [
                      {
                        values: [rearrangedResults.map(result => result.nb_reqs - result.nb_successful_reqs)],
                        type: 'pie',
                        sort: false
                      },
                      {
                        title: 'Total number of unsuccessful requests'
                      }
                    ],
                    label: 'Unsuccessful Requests',
                    method: 'update'
                  }
                ],
                direction: 'down',
                type: 'buttons'
              }]
            };
            Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, {displaylogo: false});
          })
          .catch((error) => console.log(error));
        }

        function monthAndYearPlots(details = "month") {
          let url = null;
          if (details === "year") {
            url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}&level=node&details=year&hllvalues=true&format=json`;
          }
          else {
            url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}&level=node&details=month&hllvalues=true&format=json`;
          }
          fetch(url)
            .then((response) => {
              if (response.ok) {
                return response.json();
              }
              else {
                response.text().then(errorMessage => {
                  if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                    if (details === "month") {
                      let monthplots = document.getElementById('error-month');
                      monthplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                    }
                    else {
                      let yearplots = document.getElementById('error-year');
                      yearplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                    }
                  }
                  else if (response.status >= 400 && response.status < 500) {
                    if (details === "month") {
                      let monthplots = document.getElementById('error-month');
                      monthplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                    }
                    else {
                      let yearplots = document.getElementById('error-year');
                      yearplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                    }
                  }
                });
                throw Error(response.statusText);
              }
            })
            .then((data) => {
              // calculate hll values for total clients all nodes indicator plot
              let hlls = {};
              data.results.forEach(result => {
                if (!hlls[result.date]) {
                  hlls[result.date] = new HLL(11, 5);
                }
                hlls[result.date].union(fromHexString(result.hll_clients).hllSet);
              });
              // needed for clients of all specified nodes plot
              let clientsAllNodes = [];
              Object.keys(nodesColors).forEach(node => {
                clientsAllNodes.push([]);
              });
              clientsAllNodes[clientsAllNodes.length - 1] = Object.values(hlls).map(hll => hll.cardinality());
              // show clients at first
              const barData = Object.keys(nodesColors).reverse().map((node, index) => {
                  const nodeResults = data.results.filter(result => result.node === node);
                  return {
                    x: nodeResults.map(result => result.date),
                    y1: nodeResults.map(result => result.clients),
                    y2: nodeResults.map(result => result.bytes),
                    y3: nodeResults.map(result => result.nb_reqs),
                    y4: nodeResults.map(result => result.nb_successful_reqs),
                    y5: nodeResults.map(result => result.nb_reqs - result.nb_successful_reqs),
                    name: node,
                    type: 'bar',
                    marker: {
                      color: nodesColors[node]
                    }
                  }
              });
              let barLayout = {
                barmode: 'stack',
                title: 'Number of unique users* per '+details,
                xaxis: {
                  title: details.charAt(0).toUpperCase() + details.slice(1),
                  tickmode: 'linear'
                },
                yaxis: {
                  title: 'Unique users*'
                },
                annotations: [
                  {
                    x: -0.1,
                    y: -0.3,
                    xref: 'paper',
                    yref: 'paper',
                    text: '*<i>Important note: The number of unique users is correct for each node. However, the total number<br> of unique users for all selected nodes, i.e. the height of the bars, does not represent the real value,<br> as many clients may have asked data from multiple nodes.<\i>',
                    showarrow: false,
                    font: {
                      family: 'Arial',
                      size: 12,
                      color: 'black'
                    },
                    align: 'left'
                  }
                ],
                updatemenus: [{
                  buttons: [
                    // clients per node button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x),
                          y: barData.map(bar => bar.y1),
                          name: barData.map(bar => bar.name),
                          type: 'bar'
                        },
                        {
                          title: 'Number of unique users* per '+details,
                          yaxis: {
                            title: 'Unique users*'
                          },
                          showlegend: true,
                          annotations: [
                            {
                              x: -0.1,
                              y: -0.3,
                              xref: 'paper',
                              yref: 'paper',
                              text: '*<i>Important note: The number of unique users is correct for each node. However, the total number<br> of unique users for all selected nodes, i.e. the height of the bars, does not represent the real value,<br> as many clients may have asked data from multiple nodes.<\i>',
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              },
                              align: 'left'
                            }
                          ]
                        }
                      ],
                      label: 'Unique Users Per Node',
                      method: 'update'
                    },
                    // clients all specified nodes button
                    {
                      args: [
                        {
                          x: [Object.keys(hlls)],
                          y: clientsAllNodes,
                          name: Array(Object.keys(nodesColors).length).fill(""),
                          type: 'bar'
                        },
                        {
                          title: 'Number of unique users of all specified nodes per '+details,
                          yaxis: {
                            title: 'Unique Users'
                          },
                          showlegend: false,
                          annotations: []
                        }
                      ],
                      label: 'Unique Users All Nodes',
                      method: 'update'
                    },
                    // bytes button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x),
                          y: barData.map(bar => bar.y2),
                          name: barData.map(bar => bar.name),
                          type: 'bar'
                        },
                        {
                          title: 'Number of bytes per '+details,
                          yaxis: {
                            title: 'Bytes'
                          },
                          showlegend: true,
                          annotations: []
                        }
                      ],
                      label: 'Bytes',
                      method: 'update'
                    },
                    // total requests button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x),
                          y: barData.map(bar => bar.y3),
                          name: barData.map(bar => bar.name),
                          type: 'bar'
                        },
                        {
                          title: 'Number of total requests per '+details,
                          yaxis: {
                            title: 'Total Requests'
                          },
                          showlegend: true,
                          annotations: []
                        }
                      ],
                      label: 'Total Requests',
                      method: 'update'
                    },
                    // successful requests button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x),
                          y: barData.map(bar => bar.y4),
                          name: barData.map(bar => bar.name),
                          type: 'bar'
                        },
                        {
                          title: 'Number of successful requests per '+details,
                          yaxis: {
                            title: 'Successful Requests'
                          },
                          showlegend: true,
                          annotations: []
                        }
                      ],
                      label: 'Successful Requests',
                      method: 'update'
                    },
                    // unsuccessful requests button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x),
                          y: barData.map(bar => bar.y5),
                          name: barData.map(bar => bar.name),
                          type: 'bar'
                        },
                        {
                          title: 'Number of unsuccessful requests per '+details,
                          yaxis: {
                            title: 'Unsuccessful Requests'
                          },
                          showlegend: true,
                          annotations: []
                        }
                      ],
                      label: 'Unsuccessful Requests',
                      method: 'update'
                    }
                  ],
                  direction: 'down',
                  type: 'buttons'
                }]
              };
              if (details === "year") {
                barLayout.xaxis["dtick"] = 1;
              }
              else if (details === "month") {
                barLayout.xaxis["dtick"] = "M1";
              }
              Plotly.newPlot(details+'-plots', barData.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: 'bar', marker: bar.marker})), barLayout, {displaylogo: false});
            })
            .catch((error) => console.log(error));
        }

        function mapPlots() {
          const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}&level=node&details=country&hllvalues=true&format=json`;
          fetch(url)
            .then((response) => {
              if (response.ok) {
                return response.json();
              }
              else {
                response.text().then(errorMessage => {
                  if (errorMessage.includes('Internal') || errorMessage.includes('Time-out')) {
                    let mapplots = document.getElementById('error-map');
                    mapplots.innerHTML = "Service is temporarily unavailable. Please try again.";
                  }
                  else if (response.status >= 400 && response.status < 500) {
                    let mapplots = document.getElementById('error-map');
                    mapplots.innerHTML = errorMessage.match(/<p>(.*?)<\/p>/)[0];
                  }
                });
                throw Error(response.statusText);
              }
            })
            .then((data) => {
              // remove nodes not included in the results
              for (const node in nodesColors) {
                if (!data.results.map(result => result.node).includes(node)) {
                  delete nodesColors[node];
                }
              }
              // aggregate the results per country
              let aggregatedResults = data.results.reduce((aggregate, result) => {
                if (!aggregate[result.country]) {
                  aggregate[result.country] = {
                    country: result.country,
                    clients: new HLL(11, 5),
                    bytes: 0,
                    nb_reqs: 0,
                    nb_successful_reqs: 0,
                  };
                }
                aggregate[result.country].clients.union(fromHexString(result.hll_clients).hllSet);
                aggregate[result.country].bytes += result.bytes;
                aggregate[result.country].nb_reqs += result.nb_reqs;
                aggregate[result.country].nb_successful_reqs += result.nb_successful_reqs;
                return aggregate;
              }, {});
              for (const country in aggregatedResults) {
                aggregatedResults[country].clients = aggregatedResults[country].clients.cardinality();
              }

              // convert ISO-2 to ISO-3 country codes
              const iso2ToIso3 = require('country-iso-2-to-3');
              const countryCodesISO3 = Object.values(aggregatedResults).map(result => result.country).map(code => iso2ToIso3(code));

              // show clients to all nodes at first
              const mapData = [{
                locationmode: 'ISO-3',
                locations: countryCodesISO3,
                z: Object.values(aggregatedResults).map(result => result.clients),
                type: 'choroplethmapbox',
                geojson: new URL('./world-countries.json', import.meta.url).href,
                colorscale: 'Viridis',
                autocolorscale: false,
                reversescale: true
              }];
              let mapLayout = {
                title: 'Number of unique users per country',
                width: 1000,
                mapbox: {
                  style: "open-street-map",
                  center: {lon: 0, lat: 20},
                  zoom: 0
                },
                updatemenus: [{
                  buttons: [
                    // clients button
                    {
                      args: [
                        {
                          z: [Object.values(aggregatedResults).map(result => result.clients)],
                          type: 'choroplethmapbox',
                          colorscale: 'Viridis',
                          autocolorscale: false,
                          reversescale: true
                        },
                        {
                          title: 'Number of unique users per country',
                        }
                      ],
                      label: 'Unique Users',
                      method: 'update'
                    },
                    // bytes button
                    {
                      args: [
                        {
                          z: [Object.values(aggregatedResults).map(result => result.bytes)],
                          type: 'choroplethmapbox',
                          colorscale: 'Viridis',
                          autocolorscale: false,
                          reversescale: true
                        },
                        {
                          title: 'Number of bytes per country',
                        }
                      ],
                      label: 'Bytes',
                      method: 'update'
                    },
                    // total requests button
                    {
                      args: [
                        {
                          z: [Object.values(aggregatedResults).map(result => result.nb_reqs)],
                          type: 'choroplethmapbox',
                          colorscale: 'Viridis',
                          autocolorscale: false,
                          reversescale: true
                        },
                        {
                          title: 'Number of unique users per country',
                        }
                      ],
                      label: 'Total Requests',
                      method: 'update'
                    },
                    // successful requests button
                    {
                      args: [
                        {
                          z: [Object.values(aggregatedResults).map(result => result.nb_successful_reqs)],
                          type: 'choroplethmapbox',
                          colorscale: 'Viridis',
                          autocolorscale: false,
                          reversescale: true
                        },
                        {
                          title: 'Number of successful requests per country',
                        }
                      ],
                      label: 'Successful Requests',
                      method: 'update'
                    },
                    // unsuccessful requests button
                    {
                      args: [
                        {
                          z: [Object.values(aggregatedResults).map(result => result.nb_reqs - result.nb_successful_reqs)],
                          type: 'choroplethmapbox',
                          colorscale: 'Viridis',
                          autocolorscale: false,
                          reversescale: true
                        },
                        {
                          title: 'Number of unsuccessful requests per country',
                        }
                      ],
                      label: 'Unsuccessful Requests',
                      method: 'update'
                    }
                  ],
                  direction: 'down',
                  type: 'buttons'
                }]
              };
              Plotly.newPlot('country-plots', mapData, mapLayout, {displaylogo: false});

              let nodeCheckboxes = Object.keys(nodesColors).map((node, index) => (
                <div key={index}>
                  <input type="checkbox" id={`node-${index}`} value={node} defaultChecked onChange={handleCheckboxClick} />
                  <label htmlFor={`node-${index}`}>{node}</label>
                </div>
              ));
              const nodeCheckboxesContainer = document.getElementById('node-checkboxes');
              nodeCheckboxesContainer.innerHTML = '';
              ReactDOM.createRoot(nodeCheckboxesContainer).render(nodeCheckboxes);
              let lastClickedTime = 0;
              let lastClickedCheckbox = null;
              function handleCheckboxClick(event) {
                // first define checkboxes behavior
                const checkbox = event.target;
                const currentTime = new Date().getTime();
                const timeDiff = currentTime - lastClickedTime;
                const checkboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]');
                const checkedCount = document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked').length;
                if (checkbox === lastClickedCheckbox && timeDiff < 300) {
                  if (checkedCount === 1 && checkbox.checked) {
                    checkboxes.forEach((cb) => {
                      cb.checked = true;
                    });
                  }
                  else {
                    checkboxes.forEach((cb) => {
                      cb.checked = (cb === checkbox);
                    });
                  }
                }
                lastClickedCheckbox = checkbox;
                lastClickedTime = currentTime;
                // now update the plot with appropriate data
                const checked = document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked');
                const selectedNodes = [];
                checked.forEach((cb) => {
                  selectedNodes.push(cb.value);
                })
                const filteredData = data.results.filter((result) => selectedNodes.includes(result.node));
                aggregatedResults = filteredData.reduce((aggregate, result) => {
                  if (!aggregate[result.country]) {
                    aggregate[result.country] = {
                      country: result.country,
                      clients: new HLL(11, 5),
                      bytes: 0,
                      nb_reqs: 0,
                      nb_successful_reqs: 0,
                    };
                  }
                  aggregate[result.country].clients.union(fromHexString(result.hll_clients).hllSet);
                  aggregate[result.country].bytes += result.bytes;
                  aggregate[result.country].nb_reqs += result.nb_reqs;
                  aggregate[result.country].nb_successful_reqs += result.nb_successful_reqs;
                  return aggregate;
                }, {});
                for (const country in aggregatedResults) {
                  aggregatedResults[country].clients = aggregatedResults[country].clients.cardinality();
                }
                const newCountryCodesISO3 = Object.values(aggregatedResults).map(result => result.country).map(code => iso2ToIso3(code));
                const activeButtonIndex = mapLayout.updatemenus[0].active;
                const zValues = Object.values(aggregatedResults).map(result => {
                  if (activeButtonIndex === 0 || activeButtonIndex === undefined) {
                    return result.clients;
                  } else if (activeButtonIndex === 1) {
                    return result.bytes;
                  } else if (activeButtonIndex === 2) {
                    return result.nb_reqs;
                  } else if (activeButtonIndex === 3) {
                    return result.nb_successful_reqs;
                  } else if (activeButtonIndex === 4) {
                    return result.nb_reqs - result.nb_successful_reqs;
                  }
                });
                const newMapData = [{
                  locationmode: 'ISO-3',
                  locations: newCountryCodesISO3,
                  z: zValues,
                  type: 'choroplethmapbox',
                  geojson: new URL('./world-countries.json', import.meta.url).href,
                  colorscale: 'Viridis',
                  autocolorscale: false,
                  reversescale: true
                }];
                mapLayout.updatemenus[0].buttons.forEach((button, index) => {
                  if (button && index === 0) {
                    button.args[0].z = [Object.values(aggregatedResults).map(result => result.clients)]
                  } else if (button && index === 1) {
                    button.args[0].z = [Object.values(aggregatedResults).map(result => result.bytes)]
                  } else if (button && index === 2) {
                    button.args[0].z = [Object.values(aggregatedResults).map(result => result.nb_reqs)]
                  } else if (button && index === 3) {
                    button.args[0].z = [Object.values(aggregatedResults).map(result => result.nb_successful_reqs)]
                  } else if (button && index === 4) {
                    button.args[0].z = [Object.values(aggregatedResults).map(result => result.nb_reqs - result.nb_successful_reqs)]
                  }
                });
                Plotly.react('country-plots', newMapData, mapLayout);
              }
            })
            .catch((error) => console.log(error))
            .finally(() => {
              // remove loading message
              clearInterval(intervalId);
              loadingMsg.innerHTML = "";
            });
        }
  })
  .catch((error) => {
    console.log(error);
    // remove loading message
    clearInterval(intervalId);
    loadingMsg.innerHTML = "";
  });
}
