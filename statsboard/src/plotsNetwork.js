import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';
import {HLL, fromHexString} from './js_hll'

export function makePlotsNetwork(startTime, endTime, node, network) {

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

  totalPlots();
  monthAndYearPlots("month");
  monthAndYearPlots("year");
  mapPlots();

  function totalPlots() {
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${network ? `&network=${network}` : ''}&level=network&hllvalues=true&format=json`;
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
        // sort results alphabetically by network
        data.results.sort((a, b) => {
          const networkA = a.network;
          const networkB = b.network;
          if (networkA < networkB) {
            return -1;
          }
          else if (networkA > networkB) {
            return 1;
          }
          return 0;
        });
        // calculate hll values for total clients all networks indicator plot
        let hll = new HLL(11, 5);
        data.results.forEach((result) => {
          hll.union(fromHexString(result.hll_clients).hllSet);
        });
        // clients plot, per network pie at first
        const pieDataClients = {
          values: data.results.map(result => result.clients),
          labels: data.results.map(result => result.network || " "),
          type: 'pie',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutClients = {
          title: 'Total number of unique users*',
          annotations: [
            {
              x: -1,
              y: -0.3,
              xref: 'paper',
              yref: 'paper',
              text: '*<i>Important note: The number of unique users is correct for each network.<br>However, the whole pie does not represent the real value of the total users for<br>all selected networks, as many clients may have asked data from multiple networks.<\i>',
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
              // total clients per network pie button
              {
                args: [
                  {
                    values: [data.results.map(result => result.clients)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unique users*',
                    annotations: [
                      {
                        x: -1,
                        y: -0.3,
                        xref: 'paper',
                        yref: 'paper',
                        text: '*<i>Important note: The number of unique users is correct for each network.<br>However, the whole pie does not represent the real value of the total users for<br>all selected networks, as many clients may have asked data from multiple networks.<\i>',
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
                label: 'Unique Users Per Network',
                method: 'update'
              },
              // total clients for all specified networks indicator button
              {
                args: [
                  {
                    type: "indicator",
                    value: hll.cardinality(),
                    mode: "number",
                    number: { font: { size: 50 } }
                  },
                  {
                    title: 'Total number of unique users of all specified networks',
                    annotations: []
                  }
                ],
                label: 'Unique Users All Networks',
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
          values: data.results.map(result => result.bytes),
          labels: data.results.map(result => result.network || " "),
          type: 'pie',
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
          values: data.results.map(result => result.nb_reqs),
          labels: data.results.map(result => result.network || " "),
          type: 'pie',
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
                    values: [data.results.map(result => result.nb_reqs)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of requests',
                  }
                ],
                label: 'Total Requests',
                method: 'update'
              },
              // successful requests button
              {
                args: [
                  {
                    values: [data.results.map(result => result.nb_successful_reqs)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of successful requests',
                  }
                ],
                label: 'Successful Requests',
                method: 'update'
              },
              // unsuccessful requests button
              {
                args: [
                  {
                    values: [data.results.map(result => result.nb_reqs - result.nb_successful_reqs)],
                    type: 'pie',
                    sort: false
                  },
                  {
                    title: 'Total number of unsuccessful requests',
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
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${network ? `&network=${network}` : ''}&level=network&details=year&hllvalues=true&format=json`;
      }
      else {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${network ? `&network=${network}` : ''}&level=network&details=month&hllvalues=true&format=json`;
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
          const networksSorted = Array.from(new Set(data.results.map(result => result.network))).sort((a, b) => a.localeCompare(b)).reverse();
          // calculate hll values for total clients all networks bar plot
          let hlls = {};
          data.results.forEach(result => {
            if (!hlls[result.date]) {
              hlls[result.date] = new HLL(11, 5);
            }
            hlls[result.date].union(fromHexString(result.hll_clients).hllSet);
          });
          // needed for clients of all specified networks plot
          let clientsAllNetworks = [];
          networksSorted.forEach(network => {
            clientsAllNetworks.push([]);
          });
          clientsAllNetworks[networksSorted.length - 1] = Object.values(hlls).map(hll => hll.cardinality());
          // show clients at first
          const barData = networksSorted.map(network => {
              const networkResults = data.results.filter(result => result.network === network);
              return {
                x: networkResults.map(result => result.date),
                y1: networkResults.map(result => result.clients),
                y2: networkResults.map(result => result.bytes),
                y3: networkResults.map(result => result.nb_reqs),
                y4: networkResults.map(result => result.nb_successful_reqs),
                y5: networkResults.map(result => result.nb_reqs - result.nb_successful_reqs),
                name: network,
                type: 'bar'
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
                text: '*<i>Important note: The number of unique users is correct for each network. However, the total number<br> of unique users for all selected networks, i.e. the height of the bars, does not represent the real value,<br> as many clients may have asked data from multiple networks.<\i>',
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
                // clients per network button
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
                          text: '*<i>Important note: The number of unique users is correct for each network. However, the total number<br> of unique users for all selected networks, i.e. the height of the bars, does not represent the real value,<br> as many clients may have asked data from multiple networks.<\i>',
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
                  label: 'Unique Users Per Network',
                  method: 'update'
                },
                // clients all specified networks button
                {
                  args: [
                    {
                      x: [Object.keys(hlls)],
                      y: clientsAllNetworks,
                      name: Array(networksSorted.length).fill(""),
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users of all specified networks per '+details,
                      yaxis: {
                        title: 'Unique Users'
                      },
                      showlegend: false,
                      annotations: []
                    }
                  ],
                  label: 'Unique Users All Networks',
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
          Plotly.newPlot(details+'-plots', barData.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: 'bar', hovertemplate: '(%{x}, %{value:.3s})'})), barLayout, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}${node ? `&node=${node}` : ''}${network ? `&network=${network}` : ''}&level=network&details=country&hllvalues=true&format=json`;
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
            reversescale: true,
            hovertemplate: '%{z:.3s}<extra>%{location}</extra>'
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

          const networksSorted = Array.from(new Set(data.results.map(result => result.network))).sort((a, b) => a.localeCompare(b));
          let networkCheckboxes = networksSorted.map((network, index) => (
            <div key={index}>
              <input type="checkbox" id={`network-${index}`} value={network} defaultChecked onChange={handleCheckboxClick} />
              <label htmlFor={`network-${index}`}>{network}</label>
            </div>
          ));
          const networkCheckboxesContainer = document.getElementById('nns-checkboxes');
          networkCheckboxesContainer.innerHTML = '';
          ReactDOM.createRoot(networkCheckboxesContainer).render(networkCheckboxes);
          let lastClickedTime = 0;
          let lastClickedCheckbox = null;
          function handleCheckboxClick(event) {
            // first define checkboxes behavior
            const checkbox = event.target;
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastClickedTime;
            const checkboxes = document.querySelectorAll('#nns-checkboxes input[type="checkbox"]');
            const checkedCount = document.querySelectorAll('#nns-checkboxes input[type="checkbox"]:checked').length;
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
            const checked = document.querySelectorAll('#nns-checkboxes input[type="checkbox"]:checked');
            const selectedNetworks = [];
            checked.forEach((cb) => {
              selectedNetworks.push(cb.value);
            })
            const filteredData = data.results.filter((result) => selectedNetworks.includes(result.network));
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
              reversescale: true,
              hovertemplate: '%{z:.3s}<extra>%{location}</extra>'
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
}
