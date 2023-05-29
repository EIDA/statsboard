import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';

export function makePlotsNode(startTime, endTime) {

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
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&format=json`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        // clients plot
        const pieDataClients = {
          values: data.results.map(result => result.clients),
          labels: data.results.map(result => result.node),
          type: 'pie',
          hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
          sort: false
        };
        const pieLayoutClients = {
          title: 'Total number of unique users'
        };
        Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, {displaylogo: false});

        // bytes plot
        const pieDataBytes = {
          values: data.results.map(result => result.bytes),
          labels: data.results.map(result => result.node),
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
          labels: data.results.map(result => result.node),
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
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&details=year&format=json`;
      }
      else {
        url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&details=month&format=json`;
      }
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // show clients at first
          const nodes = ['ICGC', 'UIB-NORSAR', 'NOA', 'NIEP', 'GEOFON', 'ODC', 'ETH', 'KOERI', 'INGV', 'BGR', 'LMU', 'RESIF'];
          const colors = ['#eb9a49', '#3294b8', '#17becf', '#bcbd22', '#7f7f7f', '#e377c2', '#8c564b', '#9467bd', '#d62728', '#2ca02c', '#ff7f0e', '#1f77b4'];
          const barData = nodes.map((node, index) => {
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
                  color: colors[index]
                }
              }
          });
          let barLayout = {
            barmode: 'stack',
            title: 'Number of unique users per '+details,
            xaxis: {
              title: details.charAt(0).toUpperCase() + details.slice(1),
              tickmode: 'linear'
            },
            yaxis: {
              title: 'Unique users'
            },
            updatemenus: [{
              buttons: [
                // clients button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y1),
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of unique users per '+details,
                      yaxis: {
                        title: 'Unique users'
                      }
                    }
                  ],
                  label: 'Unique Users',
                  method: 'update'
                },
                // bytes button
                {
                  args: [
                    {
                      x: barData.map(bar => bar.x),
                      y: barData.map(bar => bar.y2),
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of bytes per '+details,
                      yaxis: {
                        title: 'Bytes'
                      }
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
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of total requests per '+details,
                      yaxis: {
                        title: 'Total Requests'
                      }
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
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of successful requests per '+details,
                      yaxis: {
                        title: 'Successful Requests'
                      }
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
                      name: nodes,
                      type: 'bar'
                    },
                    {
                      title: 'Number of unsuccessful requests per '+details,
                      yaxis: {
                        title: 'Unsuccessful Requests'
                      }
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
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&details=country&format=json`;
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // aggregate the results per country
          let aggregatedResults = data.results.reduce((aggregate, result) => {
            if (!aggregate[result.country]) {
              aggregate[result.country] = {
                country: result.country,
                clients: 0,
                bytes: 0,
                nb_reqs: 0,
                nb_successful_reqs: 0,
              };
            }
            aggregate[result.country].clients += result.clients;
            aggregate[result.country].bytes += result.bytes;
            aggregate[result.country].nb_reqs += result.nb_reqs;
            aggregate[result.country].nb_successful_reqs += result.nb_successful_reqs;
            return aggregate;
          }, {});

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

          const nodes = [...new Set(data.results.map(result => result.node))];
          let nodeCheckboxes = nodes.map((node, index) => (
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
                  clients: 0,
                  bytes: 0,
                  nb_reqs: 0,
                  nb_successful_reqs: 0,
                };
              }
              aggregate[result.country].clients += result.clients;
              aggregate[result.country].bytes += result.bytes;
              aggregate[result.country].nb_reqs += result.nb_reqs;
              aggregate[result.country].nb_successful_reqs += result.nb_successful_reqs;
              return aggregate;
            }, {});
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
}
