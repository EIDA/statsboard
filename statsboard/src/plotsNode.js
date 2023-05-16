import Plotly from 'plotly.js-dist';
import ReactDOM from 'react-dom/client';

export function makePlotsNode(startTime, endTime) {

  totalPlots();
  monthAndYearPlots("month");
  monthAndYearPlots("year");
  //mapPlots();

  function totalPlots() {
    const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&format=json`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        // clients plot
        const pieDataClients = {
          values: data.results.map(result => result.clients),
          labels: data.results.map(result => result.node),
          type: 'pie'
        };
        const pieLayoutClients = {
          title: 'Total number of unique users'
        };
        Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, {displaylogo: false});

        // bytes plot
        const pieDataBytes = {
          values: data.results.map(result => result.bytes),
          labels: data.results.map(result => result.node),
          type: 'pie'
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
          const nodes = [...new Set(data.results.map(result => result.node))];
          const barData = nodes.map(node => {
              const nodeResults = data.results.filter(result => result.node === node);
              return {
                x: nodeResults.map(result => result.date),
                y1: nodeResults.map(result => result.clients),
                y2: nodeResults.map(result => result.bytes),
                y3: nodeResults.map(result => result.nb_reqs),
                y4: nodeResults.map(result => result.nb_successful_reqs),
                y5: nodeResults.map(result => result.nb_reqs - result.nb_successful_reqs),
                name: node,
                type: 'bar'
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
          Plotly.newPlot(details+'-plots', barData.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: 'bar'})), barLayout, {displaylogo: false});
        })
        .catch((error) => console.log(error));
    }

    function mapPlots() {
      const url = `https://ws.resif.fr/eidaws/statistics/1/dataselect/public?start=${startTime}${endTime ? `&end=${endTime}` : ''}&level=node&details=country&format=json`;
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          // convert ISO-2 to ISO-3 country codes
          const iso2ToIso3 = require('country-iso-2-to-3');
          const countryCodesISO3 = data.results.map(result => result.country).map(code => iso2ToIso3(code));

          // show clients from all countries at first
          const mapData = [{
            locationmode: 'ISO-3',
            locations: countryCodesISO3,
            z: data.results.map(result => result.clients),
            type: 'choroplethmapbox',
            geojson: new URL('./world-countries.json', import.meta.url).href,
            colorscale: 'Viridis',
            autocolorscale: false,
            reversescale: true
          }];
          const mapLayout = {
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
                      z: [data.results.map(result => result.clients)],
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
                      z: [data.results.map(result => result.bytes)],
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
                      z: [data.results.map(result => result.nb_reqs)],
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
                      z: [data.results.map(result => result.nb_successful_reqs)],
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
                      z: [data.results.map(result => result.nb_reqs - result.nb_successful_reqs)],
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
          const nodeCheckboxes = nodes.map((node, index) => (
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
            const checkbox = event.target;
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastClickedTime;
            if (checkbox === lastClickedCheckbox && timeDiff < 300) {
              nodeCheckboxes.forEach((cb) => {
                cb.checked = cb === checkbox;
              });
            } else {
              checkbox.checked = !checkbox.checked;
            }
            lastClickedCheckbox = checkbox;
            lastClickedTime = currentTime;
            const checkedNodes = document.querySelectorAll('input[name="node"]:checked');
            const selectedNodes = Array.from(checkedNodes).map(node => node.value);
            const filteredData = data.results.filter(result => selectedNodes.includes(result.node));
            const newMapData = [{
              locationmode: 'ISO-3',
              locations: countryCodesISO3,
              z: filteredData.map(result => result.clients),
              type: 'choroplethmapbox',
              geojson: new URL('./world-countries.json', import.meta.url).href,
              colorscale: 'Viridis',
              autocolorscale: false,
              reversescale: true
            }];
            Plotly.react('country-plots', newMapData, mapLayout);
          }
        })
        .catch((error) => console.log(error));
    }
}
