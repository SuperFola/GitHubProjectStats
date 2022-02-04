function getAuthorizationHeader() {
    const token = localStorage.getItem("token")
    return {
        Authorization: token ? `token ${token}` : "",
    }
}

async function getUserRepos(user) {
    let repoNames = []
    const url = `${apiRoot}users/${user}/repos`

    const res = await fetch(url, { headers: { ...getAuthorizationHeader() } })
    const json = await res.json()

    json.forEach(item => repoNames.push(item.name))
    return repoNames
}

async function getScope(repo, page, pageLength, scope) {
    let url = `${apiRoot}repos/${repo}/${scope.name}`
    if (page !== undefined) {
        url = `${url}?page=${page}&per_page=${pageLength}`
    }

    const res = await fetch(url, {
        method: "GET",
        headers: {
            ...scope.headers,
            ...getAuthorizationHeader(),
        },
    })
    const json = await res.json()
    return json
}

async function getRepoStargazer(repo, page, pageLength) {
    const json = await getScope(repo, page, pageLength, { name: "stargazers", headers: { Accept: "application/vnd.github.v3.star+json", }, })
    return json.map(val => val.starred_at)
}

async function getRepoForker(repo, page, pageLength) {
    const json = await getScope(repo, page, pageLength, { name: "forks", headers: {}, })
    return json.map(val => val.created_at)
}

async function getRepoData(user, repo) {
    const res = await fetch(`${apiRoot}repos/${user}/${repo}`, { headers: { ...getAuthorizationHeader(), }, })
    const json = await res.json()
    return json
}

async function getRecordFor(user, repo, repoData, ressource) {
    const maxRessource = repoData[ressource.count]

    const maxRequests = 15
    const pageLength = 100
    const range = [1, Math.ceil(maxRessource / pageLength)]
    const skipPage = Math.ceil((range[1] - range[0]) / maxRequests)

    let data = {}
    let page = 1

    while (true) {
        const next = await ressource.fetch(`${user}/${repo}`, page, pageLength)

        for (let i = 0, step = (next.length === pageLength) ? 20 : 4; i * step < next.length; ++i) {
            data[next[i * step]] = 1 + i * step + (page - 1) * pageLength
        }

        if (next.length < pageLength) {
            break
        }
        page += skipPage
    }

    return {
        history: data,
        total: maxRessource,
    }
}
