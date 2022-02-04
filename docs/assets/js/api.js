async function getUserRepos(user) {
    let repoNames = []
    const url = `${apiRoot}users/${user}/repos`

    const res = await fetch(url)
    const json = await res.json()

    json.forEach(item => repoNames.push(item.name))
    return repoNames
}

async function getScope(repo, page, pageLength, scope) {
    let url = `${apiRoot}repos/${repo}/${scope.name}`
    if (page !== undefined) {
        url = `${url}?page=${page}&per_page=${pageLength}`
    }

    const token = localStorage.getItem("token")
    const res = await fetch(url, {
        method: "GET",
        headers: {
            ...scope.headers,
            Authorization: token ? `token ${token}` : "",
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
    const res = await fetch(`${apiRoot}repos/${user}/${repo}`)
    const json = await res.json()
    return json
}
