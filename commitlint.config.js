// Conventional Commits を強制（commit-msg フック ＋ CI で検査）。
export default {
  extends: ["@commitlint/config-conventional"],
  // Dependabot は件名を "Bump …"（大文字始まり）で生成し subject-case に反する。
  // prefix は dependabot レシピの ci / chore(deps) / chore(deps-dev)。自動 PR の件名だけ検査から除外する
  // （prefix を変えたら正規表現も合わせる）。
  ignores: [(msg) => /^(ci|chore\(deps(-dev)?\)): bump /i.test(msg)],
};
