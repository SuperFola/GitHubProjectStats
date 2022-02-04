const apiRoot = "https://api.github.com/"

let pieChart = null
let lineChart = null

function formatNumber(value) {
    return value.toString().replace(/(\d)(?=(\d{3})+$)/g, '$1,')
}

function getURLParam(name) {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    return urlParams.get(name)
}

function showReleasesStats(data) {
    let err = false
    let errMessage = ''
    let html = ""

    if (data.status == 404) {
        err = true
        errMessage = "The project does not exist!"
    } else if (data.status == 403) {
        err = true
        errMessage = "You've exceeded GitHub's rate limiting.<br />Please try again in about an hour."
    }

    if (data.length == 0) {
        err = true
        errMessage = "There are no releases for this project"
    }

    if (err) {
        html += `<div class='col-md-6 col-md-offset-3 alert alert-danger'>${errMessage}</div>`
    } else {
        html += "<div class='row'>"

        let downloadsPerRelease = {}
        let totalDownloadCount = 0

        data.forEach(item => {
            let releaseTag = item.tag_name
            let releaseBadge = ""
            let releaseURL = item.html_url
            let isPreRelease = item.prerelease
            let releaseAssets = item.assets
            let releaseDownloadCount = 0
            let releaseAuthor = item.author
            let publishDate = item.published_at.split("T")[0]

            if (isPreRelease) {
                releaseBadge = "&nbsp;&nbsp;<span class='badge bg-warning'>Pre-release</span>"
            }

            let downloadInfoHTML = ""
            if (releaseAssets.length) {
                downloadInfoHTML += "<h4><span class='bi-download'></span>&nbsp;&nbsp;Download Info</h4>"
                downloadInfoHTML += "<ul>"

                releaseAssets.forEach(asset => {
                    let assetSize = (asset.size / 1048576.0).toFixed(2)
                    let lastUpdate = asset.updated_at.split("T")[0]

                    downloadInfoHTML += `<li><code>${asset.name}</code> (${assetSize}&nbsp;MiB,&nbsp;${lastUpdate}) - downloaded ${formatNumber(asset.download_count)}&nbsp;times.</li>`

                    totalDownloadCount += asset.download_count
                    releaseDownloadCount += asset.download_count
                })
            }

            let key = Object.keys(downloadsPerRelease).length > 8 ? "Others" : releaseTag
            downloadsPerRelease[key] = (downloadsPerRelease[key] || 0) + releaseDownloadCount

            html += "<div class='row release'>"
            html += `<h3><span class='bi-tag'></span>&nbsp;&nbsp;<a href='${releaseURL}' target='_blank'>${releaseTag}</a>${releaseBadge}</h3><hr>`
            html += "<h4><span class='bi-info-circle'></span>&nbsp;&nbsp;Release Info</h4>"
            html += "<ul>"

            if (releaseAuthor) {
                html += `<li><span class='bi-person'></span>&nbsp;&nbsp;Author: <a href='${releaseAuthor.html_url}'>@${releaseAuthor.login}</a></li>`
            }

            html += `<li><span class='bi-calendar'></span>&nbsp;&nbsp;Published: ${publishDate}</li>`

            if (releaseDownloadCount) {
                html += `<li><span class='bi-download'></span>&nbsp;&nbsp;Downloads: ${formatNumber(releaseDownloadCount)}</li>`
            }

            html += `</ul>${downloadInfoHTML}</div>`
        })


        if (pieChart !== null) {
            pieChart.destroy()
        }

        pieChart = new Chart("dlchart", {
            type: "pie",
            data: {
                labels: Array.from(Object.keys(downloadsPerRelease)),
                datasets: [{
                    backgroundColor: [
                        "#00876c",
                        "#44926c",
                        "#679d6f",
                        "#85a776",
                        "#a1b180",
                        "#babc8d",
                        "#d2c69e",
                        "#d1b583",
                        "#d2a26d",
                        "#d48d5c",
                        "#d67551",
                        "#d65c4e",
                        "#d43d51",
                    ],
                    data: Array.from(Object.values(downloadsPerRelease)),
                    radius: "66%",
                }]
            },
            options: {
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                width: "50%",
                height: "50%",
            },
        })

        if (totalDownloadCount) {
            let totalHTML = "<div class='row total-downloads'>"
            totalHTML += `<h4><span class='bi-download'></span>&nbsp;&nbsp;<span>${formatNumber(totalDownloadCount)}</span>&nbsp;Total Downloads</h4>`
            totalHTML += "</div>"

            html = totalHTML + html
        }

        html += "</div>"
    }

    document.getElementById("releases").innerHTML = html
}

function getAxis(history) {
    return {
        x: [...new Set(Object.values(history))],
        y: [...new Set(Object.keys(history))].map(d => (new Date(d)).getTime()),
    }
}

async function showHistoryStats(user, repository) {
    if (lineChart !== null) {
        lineChart.destroy()
    }

    const repoData = await getRepoData(user, repository)

    let starsData = await getRecordFor(user, repository, repoData, { count: "stargazers_count", fetch: getRepoStargazer, })
    let stars = getAxis(starsData.history)

    let forksData = await getRecordFor(user, repository, repoData, { count: "forks_count", fetch: getRepoForker, })
    let forks = getAxis(forksData.history)

    lineChart = new Chart("linechart", {
        type: "line",
        data: {
            labels: [stars.y, forks.y],
            datasets: [
                {
                    pointRadius: 0,
                    borderColor: 'rgba(0, 0, 0, 0.8)',
                    data: stars.x,
                    label: 'Stars',
                    tension: 0.3,
                    yAxisID: 'y',
                }, {
                    pointRadius: 0,
                    borderColor: 'rgba(0.3, 0.6, 0.1, 0.8)',
                    data: forks.x,
                    label: 'Forks',
                    tension: 0.2,
                    yAxisID: 'y1',
                }
            ],
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'week',
                    },
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                },
            },
        },
    })
}

async function getStats(user, repository, page, perPage) {
    document.getElementById("project").innerText = `${user}/${repository}`

    // releases
    {
        const url = `${apiRoot}repos/${user}/${repository}/releases?page=${page}&per_page=${perPage}`
        const res = await fetch(url, { headers: { ...getAuthorizationHeader() } })
        const json = await res.json()
        showReleasesStats(json)
    }
    // history (stars, forks...)
    {
        await showHistoryStats(user, repository)
    }
}

window.onload = () => {
    if (getURLParam("user") && getURLParam("repo")) {
        getStats(getURLParam("user"), getURLParam("repo"), 1, 50)
    }

    if (localStorage.getItem("token")) {
        document.getElementById("github_token").value = localStorage.getItem("token")
    }

    document.getElementById("set_token_btn").addEventListener("click", () => {
        let input = document.getElementById("github_token")
        input.hidden = !input.hidden
    })

    document.getElementById("get_stats_btn").addEventListener("click", () => {
        let token = document.getElementById("github_token").value
        if (token) {
            localStorage.setItem("token", token)
        }

        let user = document.getElementById("github_user").value
        let repo = document.getElementById("github_repo").value

        if (user !== "" && repo !== "") {
            getStats(user, repo, 1, 50)
        } else {
            alert("Incomplete informations")
        }
    })
}
