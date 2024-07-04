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

  // icon for custom modebar button for downloading data in csv
  let icon = {
    'width': 24,
    'height': 24,
    'path': 'M11 3.01254C10.9983 2.46026 11.4446 2.01114 11.9969 2.00941C12.5492 2.00768 12.9983 2.45399 13 3.00627L11 3.01254Z ' +
            'M14.3158 10.2951L13.0269 11.592L13 3.00627L11 3.01254L11.0269 11.5983L9.73003 10.3095C9.33828 9.92018 8.7051 9.92214 8.3158 10.3139C7.9265 10.7056 7.92849 11.3388 8.32024 11.7281L8.32275 11.7306L8.32374 11.7316L12.039 15.4236L15.7206 11.7187L15.7262 11.7131L15.727 11.7123L15.7278 11.7115L15.7337 11.7056L15.7344 11.7049L14.3158 10.2951Z ' +
            'M15.7344 11.7049C16.1237 11.3131 16.1217 10.6799 15.73 10.2906C15.3382 9.90134 14.705 9.90335 14.3158 10.2951L15.7344 11.7049Z ' +
            'M4 12C4 10.8954 4.89543 10 6 10C6.55228 10 7 9.55228 7 9C7 8.44771 6.55228 8 6 8C3.79086 8 2 9.79086 2 12V18C2 20.2091 3.79086 22 6 22H17C19.7614 22 22 19.7614 22 17V12C22 9.79086 20.2091 8 18 8C17.4477 8 17 8.44771 17 9C17 9.55228 17.4477 10 18 10C19.1046 10 20 10.8954 20 12V17C20 18.6569 18.6569 20 17 20H6C4.89543 20 4 19.1046 4 18V12Z'
  };

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
      let endYear = new Date().getFullYear();
      if (endTime) {
        endYear = endTime.split('-')[0];
      }
      if (startTime.split('-')[0] != endYear) {
        monthAndYearPlots("year");
      }
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

            // function to create a custom modebar button for downloading data as CSV
            function createDownloadButton() {
              return {
                name: 'Download CSV',
                icon: icon,
                click: function(gd) {
                  const { values, csvHeader } = getCurrentValues(gd);
                  let csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\n";
                  for (let i = 0; i < gd.data[0].labels.length; i++) {
                    csvContent += `${gd.data[0].labels[i]},${values[i]}\n`;
                  }
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "data.csv");
                  document.body.appendChild(link); // Required for Firefox
                  link.click();
                  document.body.removeChild(link); // Clean up after download
                }
              };
            }
            // function to get current plot values based on the title
            function getCurrentValues(gd) {
              const title = gd.layout.title.text;
              let values, csvHeader;
              if (title.includes('users')) {
                csvHeader = "Nodes,Users";
                values = rearrangedResults.map(result => result.clients);
              } else if (title.includes('bytes')) {
                csvHeader = "Nodes,Bytes";
                values = rearrangedResults.map(result => result.bytes);
              } else if (title.includes('of requests')) {
                csvHeader = "Nodes,TotalRequests";
                values = rearrangedResults.map(result => result.nb_reqs);
              } else if (title.includes('of successful')) {
                csvHeader = "Nodes,SuccessfulRequests";
                values = rearrangedResults.map(result => result.nb_successful_reqs);
              } else if (title.includes('unsuccessful')) {
                csvHeader = "Nodes,UnsuccessfulRequests";
                values = rearrangedResults.map(result => result.nb_reqs - result.nb_successful_reqs);
              }
              return { values, csvHeader };
            }
            // config for modebar
            const config = {
                displaylogo: false,
                modeBarButtonsToAdd: [createDownloadButton()]
            };

            // clients plot, per node pie at first
            const pieDataClients = {
              values: rearrangedResults.map(result => result.clients),
              labels: Object.keys(nodesColors),
              type: 'pie',
              marker: {
                colors: Object.values(nodesColors)
              },
              texttemplate: '%{value:.3s}',
              hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
              sort: false
            };
            const pieLayoutClients = {
              title: 'Total number of unique users* per node',
              annotations: [
                {
                  xshift: -20,
                  y: -0.29,
                  xref: 'paper',
                  yref: 'paper',
                  text: '*<i>Important note: Unique users are estimated based on anonymised<br>distinct IP addresses of the clients issuing requests. The number of<br>unique users is correct for each node. However, the whole pie does not<br>represent the real value of the total users for all selected nodes,<br>as many clients may have asked data from multiple nodes.<\i>',
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
                        title: 'Total number of unique users* per node',
                        annotations: [
                          {
                            xshift: -20,
                            y: -0.29,
                            xref: 'paper',
                            yref: 'paper',
                            text: '*<i>Important note: Unique users are estimated based on anonymised<br>distinct IP addresses of the clients issuing requests. The number of<br>unique users is correct for each node. However, the whole pie does not<br>represent the real value of the total users for all selected nodes,<br>as many clients may have asked data from multiple nodes.<\i>',
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
                    label: 'Users Per Node',
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
                        title: 'Total number of unique users* of all nodes',
                        annotations: [
                          {
                            xshift: -20,
                            y: -0.29,
                            xref: 'paper',
                            yref: 'paper',
                            text: '*<i>Important note: Unique users are estimated based on<br>anonymised distinct IP addresses of the clients issuing requests.<\i>',
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
                    label: 'Users All Nodes',
                    method: 'update'
                  }
                ],
                direction: 'down',
                type: 'buttons'
              }]
            };
            Plotly.newPlot('total-clients', [pieDataClients], pieLayoutClients, config);

            // bytes plot
            const pieDataBytes = {
              values: rearrangedResults.map(result => result.bytes),
              labels: Object.keys(nodesColors),
              type: 'pie',
              marker: {
                colors: Object.values(nodesColors)
              },
              texttemplate: '%{value:.3s}',
              hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
              sort: false
            };
            const pieLayoutBytes = {
              title: 'Total number of bytes',
              annotations: [
                {
                  xshift: +10,
                  y: -0.25,
                  xref: 'paper',
                  yref: 'paper',
                  text: '<i>The above plot shows the amount of data delivered during<br>the use of EIDA services in the specified time period.<\i>',
                  showarrow: false,
                  font: {
                    family: 'Arial',
                    size: 12,
                    color: 'black'
                  }
                }
              ],
            };
            Plotly.newPlot('total-bytes', [pieDataBytes], pieLayoutBytes, config);

            // requests plot
            // show total requests at first
            const pieDataRequests = {
              values: rearrangedResults.map(result => result.nb_reqs),
              labels: Object.keys(nodesColors),
              type: 'pie',
              marker: {
                colors: Object.values(nodesColors)
              },
              texttemplate: '%{value:.3s}',
              hovertemplate: '%{label}<br>%{value:.3s}<br>%{percent}<extra></extra>',
              sort: false
            };
            const pieLayoutRequests = {
              title: 'Total number of requests',
              annotations: [
                {
                  xshift: -20,
                  y: -0.25,
                  xref: 'paper',
                  yref: 'paper',
                  text: '<i>The above plot shows the number of total requests made to<br>the EIDA services in the specified time period.<\i>',
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
                  // total requests button
                  {
                    args: [
                      {
                        values: [rearrangedResults.map(result => result.nb_reqs)],
                        type: 'pie',
                        sort: false
                      },
                      {
                        title: 'Total number of requests',
                        annotations: [
                          {
                            xshift: -20,
                            y: -0.25,
                            xref: 'paper',
                            yref: 'paper',
                            text: '<i>The above plot shows the number of total requests made to<br>the EIDA services in the specified time period.<\i>',
                            showarrow: false,
                            font: {
                              family: 'Arial',
                              size: 12,
                              color: 'black'
                            }
                          }
                        ],
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
                        title: 'Total number of successful requests',
                        annotations: [
                          {
                            xshift: -20,
                            y: -0.25,
                            xref: 'paper',
                            yref: 'paper',
                            text: '<i>The above plot shows the number of successful requests made to<br>the EIDA services in the specified time period.<\i>',
                            showarrow: false,
                            font: {
                              family: 'Arial',
                              size: 12,
                              color: 'black'
                            }
                          }
                        ],
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
                        title: 'Total number of unsuccessful requests',
                        annotations: [
                          {
                            xshift: -20,
                            y: -0.25,
                            xref: 'paper',
                            yref: 'paper',
                            text: '<i>The above plot shows the number of unsuccessful requests<br>(i.e. requests that did not return any data) made to<br>the EIDA services in the specified time period.<\i>',
                            showarrow: false,
                            font: {
                              family: 'Arial',
                              size: 12,
                              color: 'black'
                            }
                          }
                        ],
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
            Plotly.newPlot('total-requests', [pieDataRequests], pieLayoutRequests, config);
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
              // calculate hll values for total clients all nodes bar plot
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

              // function to create a custom modebar button for downloading data as CSV
              function createDownloadButton() {
                return {
                  name: 'Download CSV',
                  icon: icon,
                  click: function(gd) {
                    const csvHeader = getAppropriateHeader(gd);
                    let csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\n";
                    if (!csvHeader.includes("UsersAllNodes")) {
                      gd.data.forEach(trace => {
                        trace.x.forEach((xValue, i) => {
                          csvContent += `${xValue},${trace.name},${trace.y[i]}\n`;
                        });
                      });
                    } else {
                      gd.data.at(-1).x.forEach((xValue, i) => {
                        csvContent += `${xValue},${gd.data.at(-1).y[i]}\n`;
                      });
                    }
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "data.csv");
                    document.body.appendChild(link); // Required for Firefox
                    link.click();
                    document.body.removeChild(link); // Clean up after download
                  }
                };
              }
              // function to get appropriate csv header based on the title
              function getAppropriateHeader(gd) {
                const title = gd.layout.title.text;
                const monthOrYear = details.charAt(0).toUpperCase() + details.slice(1)
                if (title.includes('users* per')) {
                  return `${monthOrYear},Node,UsersPerNode`;
                } else if (title.includes('users* of all')) {
                  return `${monthOrYear},UsersAllNodes`;
                } else if (title.includes('bytes')) {
                  return `${monthOrYear},Node,Bytes`;
                } else if (title.includes('total')) {
                  return `${monthOrYear},Node,TotalRequests`;
                } else if (title.includes('of successful')) {
                  return `${monthOrYear},Node,SuccessfulRequests`;
                } else if (title.includes('unsuccessful')) {
                  return `${monthOrYear},Node,UnsuccessfulRequests`;
                }
              }
              // config for modebar with the download button
              const config = {
                displaylogo: false,
                modeBarButtonsToAdd: [createDownloadButton()],
                modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d']
              };

              // show clients at first
              const barData = Object.keys(nodesColors).map((node, index) => {
                  const nodeResults = data.results.filter(result => result.node === node);
                  return {
                    x: nodeResults.map(result => result.date),
                    y1: nodeResults.map(result => result.clients),
                    y2: nodeResults.map(result => result.bytes),
                    y3: nodeResults.map(result => result.nb_reqs),
                    y4: nodeResults.map(result => result.nb_successful_reqs),
                    y5: nodeResults.map(result => result.nb_reqs - result.nb_successful_reqs),
                    name: node,
                    type: 'scatter',
                    mode: 'lines+markers',
                    hovertemplate: '(%{x}, %{y:.3s})',
                    marker: {
                      color: nodesColors[node]
                    }
                  }
              });
              let barLayout = {
                height: 500,
                margin: {
                  b: 100
                },
                barmode: 'stack',
                title: 'Number of unique users* per '+details,
                annotations: [
                  {
                    y: -0.28,
                    yref: 'paper',
                    xref: 'paper',
                    text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                    showarrow: false,
                    font: {
                      family: 'Arial',
                      size: 12,
                      color: 'black'
                    }
                  }
                ],
                xaxis: {
                  title: details.charAt(0).toUpperCase() + details.slice(1),
                  tickmode: 'linear'
                },
                yaxis: {
                  title: 'Unique users'
                },
                showlegend: true,
                updatemenus: [{
                  buttons: [
                    // clients per node button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x),
                          y: barData.map(bar => bar.y1),
                          name: barData.map(bar => bar.name),
                          type: 'scatter',
                          hovertemplate: '(%{x}, %{y:.3s})',
                          marker: Object.values(nodesColors).map(color => ({ color: color }))
                        },
                        {
                          title: 'Number of unique users* per '+details,
                          annotations: [
                            {
                              y: -0.28,
                              yref: 'paper',
                              xref: 'paper',
                              text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
                          yaxis: {
                            title: 'Unique users'
                          },
                          showlegend: true,
                        }
                      ],
                      label: 'Users Per Node',
                      method: 'update'
                    },
                    // clients all specified nodes button
                    {
                      args: [
                        {
                          x: [Object.keys(hlls)],
                          y: clientsAllNodes,
                          name: Array(Object.keys(nodesColors).length).fill(""),
                          type: 'bar',
                          hovertemplate: '(%{x}, %{value:.3s})',
                          marker: { color: Object.values(nodesColors)[0] }
                        },
                        {
                          title: 'Number of unique users* of all specified nodes per '+details,
                          annotations: [
                            {
                              y: -0.28,
                              yref: 'paper',
                              xref: 'paper',
                              text: `<i>The above plot shows the number of unique users of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>`,
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
                          yaxis: {
                            title: 'Unique Users'
                          },
                          showlegend: false,
                        }
                      ],
                      label: 'Users All Nodes',
                      method: 'update'
                    },
                    // bytes button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x).reverse(),
                          y: barData.map(bar => bar.y2).reverse(),
                          name: barData.map(bar => bar.name).reverse(),
                          type: 'bar',
                          hovertemplate: '(%{x}, %{value:.3s})',
                          marker: Object.values(nodesColors).reverse().map(color => ({ color: color }))
                        },
                        {
                          title: 'Number of bytes per '+details,
                          annotations: [
                            {
                              y: -0.27,
                              yref: 'paper',
                              xref: 'paper',
                              text: `<i>The above plot shows the amount of data delivered during the use of EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
                          yaxis: {
                            title: 'Bytes'
                          },
                          showlegend: true,
                        }
                      ],
                      label: 'Bytes',
                      method: 'update'
                    },
                    // total requests button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x).reverse(),
                          y: barData.map(bar => bar.y3).reverse(),
                          name: barData.map(bar => bar.name).reverse(),
                          type: 'bar',
                          hovertemplate: '(%{x}, %{value:.3s})',
                          marker: Object.values(nodesColors).reverse().map(color => ({ color: color }))
                        },
                        {
                          title: 'Number of total requests per '+details,
                          annotations: [
                            {
                              y: -0.27,
                              yref: 'paper',
                              xref: 'paper',
                              text: `<i>The above plot shows the number of total requests made to the EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
                          yaxis: {
                            title: 'Total Requests'
                          },
                          showlegend: true,
                        }
                      ],
                      label: 'Total Requests',
                      method: 'update'
                    },
                    // successful requests button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x).reverse(),
                          y: barData.map(bar => bar.y4).reverse(),
                          name: barData.map(bar => bar.name).reverse(),
                          type: 'bar',
                          hovertemplate: '(%{x}, %{value:.3s})',
                          marker: Object.values(nodesColors).reverse().map(color => ({ color: color }))
                        },
                        {
                          title: 'Number of successful requests per '+details,
                          annotations: [
                            {
                              y: -0.27,
                              yref: 'paper',
                              xref: 'paper',
                              text: `<i>The above plot shows the number of successful requests made to the EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
                          yaxis: {
                            title: 'Successful Requests'
                          },
                          showlegend: true,
                        }
                      ],
                      label: 'Successful Requests',
                      method: 'update'
                    },
                    // unsuccessful requests button
                    {
                      args: [
                        {
                          x: barData.map(bar => bar.x).reverse(),
                          y: barData.map(bar => bar.y5).reverse(),
                          name: barData.map(bar => bar.name).reverse(),
                          type: 'bar',
                          hovertemplate: '(%{x}, %{value:.3s})',
                          marker: Object.values(nodesColors).reverse().map(color => ({ color: color }))
                        },
                        {
                          title: 'Number of unsuccessful requests per '+details,
                          annotations: [
                            {
                              y: -0.27,
                              yref: 'paper',
                              xref: 'paper',
                              text: `<i>The above plot shows the number of unsuccessful requests made to the EIDA services per ${details}.${details === "year" ? ' Only months that were specified are included.' : ''}<\i>`,
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
                          yaxis: {
                            title: 'Unsuccessful Requests'
                          },
                          showlegend: true,
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
              Plotly.newPlot(details+'-plots', barData.map(bar => ({x: bar.x, y: bar.y1, name: bar.name, type: bar.type, mode: bar.mode, marker: bar.marker, hovertemplate: bar.hovertemplate})), barLayout, config);
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

              // function to create a custom modebar button for downloading data as CSV
              function createDownloadButton() {
                return {
                  name: 'Download CSV',
                  icon: icon,
                  click: function(gd) {
                    const { csvHeader, csvRows } = getCurrentValues(gd);
                    let csvContent = "data:text/csv;charset=utf-8," + csvHeader + "\n";
                    csvRows.forEach(row => {
                      csvContent += row.join(',') + "\n";
                    });
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "data.csv");
                    document.body.appendChild(link); // Required for Firefox
                    link.click();
                    document.body.removeChild(link); // Clean up after download
                  }
                };
              }
              // function to get current plot values based on the title
              function getCurrentValues(gd) {
                const title = gd.layout.title.text;
                let csvHeader, csvRows = [];
                if (title.includes('users')) {
                  csvHeader = "Country,Node,Users";
                  data.results.forEach(result => {
                    csvRows.push([result.country, result.node, result.clients]);
                  });
                } else if (title.includes('bytes')) {
                  csvHeader = "Country,Node,Bytes";
                  data.results.forEach(result => {
                    csvRows.push([result.country, result.node, result.bytes]);
                  });
                } else if (title.includes('total')) {
                  csvHeader = "Country,Node,TotalRequests";
                  data.results.forEach(result => {
                    csvRows.push([result.country, result.node, result.nb_reqs]);
                  });
                } else if (title.includes('of successful')) {
                  csvHeader = "Country,Node,SuccessfulRequests";
                  data.results.forEach(result => {
                    csvRows.push([result.country, result.node, result.nb_successful_reqs]);
                  });
                } else if (title.includes('unsuccessful')) {
                  csvHeader = "Country,Node,UnsuccessfulRequests";
                  data.results.forEach(result => {
                    csvRows.push([result.country, result.node, result.nb_reqs - result.nb_successful_reqs]);
                  });
                }
                return { csvHeader, csvRows };
              }
              // config for modebar with the download button
              const config = {
                displaylogo: false,
                modeBarButtonsToAdd: [createDownloadButton()],
                modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d']
              };

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
                title: 'Number of unique users* per country',
                annotations: [
                  {
                    y: -0.15,
                    yref: 'paper',
                    xref: 'paper',
                    text: '<i>The above plot shows the number of unique users of EIDA services from each country.<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>',
                    showarrow: false,
                    font: {
                      family: 'Arial',
                      size: 12,
                      color: 'black'
                    }
                  }
                ],
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
                          title: 'Number of unique users* per country',
                          annotations: [
                            {
                              y: -0.15,
                              yref: 'paper',
                              xref: 'paper',
                              text: '<i>The above plot shows the number of unique users of EIDA services from each country.<br>*Important note: Unique users are estimated based on anonymised distinct IP addresses of the clients issuing requests.<\i>',
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
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
                          annotations: [
                            {
                              y: -0.15,
                              yref: 'paper',
                              xref: 'paper',
                              text: '<i>The above plot shows the amount of data delivered to users of EIDA services from each country.<\i>',
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
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
                          title: 'Number of total requests per country',
                          annotations: [
                            {
                              y: -0.15,
                              yref: 'paper',
                              xref: 'paper',
                              text: '<i>The above plot shows the number of total requests made to the EIDA services from each country.<\i>',
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
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
                          annotations: [
                            {
                              y: -0.15,
                              yref: 'paper',
                              xref: 'paper',
                              text: '<i>The above plot shows the number of successful requests made to the EIDA services from each country.<\i>',
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
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
                          annotations: [
                            {
                              y: -0.15,
                              yref: 'paper',
                              xref: 'paper',
                              text: '<i>The above plot shows the number of unsuccesssful requests (i.e. requests that did not return any data) made to the EIDA services from each country.<\i>',
                              showarrow: false,
                              font: {
                                family: 'Arial',
                                size: 12,
                                color: 'black'
                              }
                            }
                          ],
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
              Plotly.newPlot('country-plots', mapData, mapLayout, config);

              let nodeCheckboxes = Object.keys(nodesColors).map((node, index) => (
                <div key={index}>
                  <input type="checkbox" id={`node-${index}`} value={node} defaultChecked onChange={handleCheckboxClick} />
                  <label htmlFor={`node-${index}`}>{node}</label>
                </div>
              ));
              const nodeCheckboxesContainer = document.getElementById('nns-checkboxes');
              nodeCheckboxesContainer.innerHTML = '';
              ReactDOM.createRoot(nodeCheckboxesContainer).render(nodeCheckboxes);
              const mapAndBoxes = document.getElementById('mapAndBoxes');
              mapAndBoxes.style.backgroundColor = 'white';
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
  })
  .catch((error) => {
    console.log(error);
    // remove loading message
    clearInterval(intervalId);
    loadingMsg.innerHTML = "";
  });
}
