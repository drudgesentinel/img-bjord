unit module bjfunctions;

my constant $CONTAINER = 'imageboard-pg';
my constant $IMAGE = 'docker.io/library/postgres:16';

sub run-or-die(*@cmd, :$ok-exitcodes = (0)) {
    my $proc = run |@cmd;
    unless $proc.exitcode ∈ $ok-exitcodes {
        note "Command failed: {@cmd.join(' ')}";
        note "Exit code: {$proc.exitcode}";
        exit $proc.exitcode;
    }
    $proc
}

sub require-database-url() returns Str {
    my $url = %*ENV<DATABASE_URL> // '';
    if !$url.trim {
        note 'DATABASE_URL is required';
        exit 1;
    }
    $url.trim
}

sub apply-schema(Str $database-url, Str $schema-path = 'db/schema.sql') {
    my $schema = $schema-path.IO;
    if !$schema.e {
        note "Schema file not found: {$schema-path}";
        exit 1;
    }

    run-or-die <psql>, $database-url, < -v ON_ERROR_STOP=1 -f >, $schema-path;
}

sub container-exists() returns Bool {
    my $p = run <podman container exists>, $CONTAINER;
    $p.exitcode == 0
}

sub ensure-db-up() {
    if container-exists() {
        run-or-die <podman start>, $CONTAINER;
    } else {
        my @cmd = <
            podman run --rm -d
            --name imageboard-pg
            -p 5432:5432
            -e POSTGRES_PASSWORD=postgres
            -e POSTGRES_DB=imageboard
        >;
        @cmd.push($IMAGE);
        run-or-die @cmd;
    }
}

sub wait-for-db(:$timeout = 10) {
    say 'waiting for postgres to be ready...';

    for 1..$timeout {
        my $p = run <podman exec>, $CONTAINER, <pg_isready -U postgres>, :out, :err;
        if $p.exitcode == 0 {
            say 'postgres is ready.';
            return;
        }
        sleep 1;
    }

    note "postgres did not become ready within {$timeout}s";
    exit 1;
}

sub run-app-psql(Str $sql, Str :$profile) {
    if $profile eq 'prod' {
        my $url = require-database-url();
        run-or-die <psql>, $url, < -v ON_ERROR_STOP=1 -c >, $sql;
    } else {
        ensure-db-up();
        run-or-die <podman exec -i>, $CONTAINER,
            <psql -U postgres -d imageboard -v ON_ERROR_STOP=1>,
            '-c', $sql;
    }
}

sub prompt-secret(Str $message --> Str) {
    print $message;
    $*OUT.flush;

    run <stty -echo>, :out, :err;
    my $secret = $*IN.get // '';
    run <stty echo>, :out, :err;

    say '';
    $secret
}

sub handle-db(Str $cmd, Str :$profile) {
    given $cmd {
        when any <up start> {
            if $profile eq 'prod' {
                my $database-url = require-database-url();
                say 'Applying schema to DATABASE_URL';
                apply-schema($database-url);
            } else {
                say 'bringing up postgres (podman)';

                ensure-db-up();
                wait-for-db();

                say 'applying schema to app database';
                run-or-die <./scripts/db-init.sh>, 'imageboard';

                say 'applying schema to test database';
                run-or-die <./scripts/db-init.sh>, 'imageboard_test';
            }
        }

        when any <down stop> {
            if $profile eq 'prod' {
                say 'bjprod uses DATABASE_URL only; no container to stop';
            } else {
                say 'stopping postgres container (if running)';
                run-or-die <podman stop>, $CONTAINER, :ok-exitcodes(0, 125);
            }
        }

        when any <nuke delete> {
            if $profile eq 'prod' {
                say 'bjprod uses DATABASE_URL only; no container to delete';
            } else {
                say 'deleting postgres container (if exists)';
                run-or-die <podman rm -f>, $CONTAINER, :ok-exitcodes(0, 125);
            }
        }

        default {
            note "Unknown db command: {$cmd}";
            exit 1;
        }
    }
}

sub handle-admin(Str $cmd, $name?, Str :$profile) {
    given $cmd {
        when any <create-admin-user cau> {
            my $username = $name // prompt 'Admin username: ';
            my $password = prompt-secret('Admin password: ');
            $username = $username.trim;
            if !$username || !$password {
                note 'Username and password are required';
                exit 1;
            }

            my $escaped-username = $username.subst("'", "''", :g);
            my $escaped-password = $password.subst("'", "''", :g);

            run-app-psql("INSERT INTO users (username, password_hash, is_approved, is_admin) VALUES ('{$escaped-username}', crypt('{$escaped-password}', gen_salt('bf')), true, true);", :$profile);
        }

        when any <create-user cu> {
            my $username = $name // prompt 'Username: ';
            my $password = prompt-secret('Password: ');
            $username = $username.trim;
            if !$username || !$password {
                note 'Username and password are required';
                exit 1;
            }

            my $escaped-username = $username.subst("'", "''", :g);
            my $escaped-password = $password.subst("'", "''", :g);

            run-app-psql("INSERT INTO users (username, password_hash) VALUES ('{$escaped-username}', crypt('{$escaped-password}', gen_salt('bf')));", :$profile);
        }

        when any <approve a> {
            my $target = $name // prompt 'Username or user id to approve: ';
            $target = $target.trim;
            if !$target {
                note 'Username or user id is required';
                exit 1;
            }

            my $escaped-target = $target.subst("'", "''", :g);

            run-app-psql("UPDATE users SET is_approved = true WHERE username = '{$escaped-target}' OR id::text = '{$escaped-target}';", :$profile);
            run-app-psql("SELECT id, username, is_approved, activation_code FROM users WHERE username = '{$escaped-target}' OR id::text = '{$escaped-target}';", :$profile);
        }

        when any <promote p> {
            my $target-username = $name // prompt 'Username to promote: ';
            $target-username = $target-username.trim;
            if !$target-username {
                note 'Username is required';
                exit 1;
            }

            my $escaped-username = $target-username.subst("'", "''", :g);

            run-app-psql("UPDATE users SET is_admin = true WHERE username = '{$escaped-username}';", :$profile);
            run-app-psql("SELECT username, is_admin FROM users WHERE username = '{$escaped-username}';", :$profile);
        }

        when any <rename rn> {
            my $target = $name // prompt 'Current username or user id: ';
            my $new-username = prompt 'New username: ';

            $target = $target.trim;
            $new-username = $new-username.trim;

            if !$target || !$new-username {
                note 'Both current username/user id and new username are required';
                exit 1;
            }

            if $target eq $new-username {
                note 'New username must be different from current username/user id';
                exit 1;
            }

            my $escaped-target = $target.subst("'", "''", :g);
            my $escaped-new = $new-username.subst("'", "''", :g);

            run-app-psql("INSERT INTO consumed_usernames (username) VALUES ('{$escaped-new}') ON CONFLICT (username) DO NOTHING;", :$profile);
            run-app-psql("UPDATE users SET username = '{$escaped-new}' WHERE username = '{$escaped-target}' OR id::text = '{$escaped-target}';", :$profile);
            run-app-psql("SELECT id, username, is_approved, is_admin FROM users WHERE username = '{$escaped-new}';", :$profile);
        }

        when any <password-reset pr> {
            my $target = $name // prompt 'Username or user id to reset password: ';
            my $new-password = prompt-secret('New password: ');

            $target = $target.trim;
            if !$target || !$new-password {
                note 'Both username/user id and new password are required';
                exit 1;
            }

            my $escaped-target = $target.subst("'", "''", :g);
            my $escaped-password = $new-password.subst("'", "''", :g);

            run-app-psql("UPDATE users SET password_hash = crypt('{$escaped-password}', gen_salt('bf')) WHERE username = '{$escaped-target}' OR id::text = '{$escaped-target}';", :$profile);
            run-app-psql("SELECT id, username, is_approved, is_admin FROM users WHERE username = '{$escaped-target}' OR id::text = '{$escaped-target}';", :$profile);
        }

        when any <board makeboard> {
            my $slug = prompt "Board slug (e.g. 'b'): ";
            my $board-name = $name // prompt "Board name (e.g. 'Random'): ";
            $slug = $slug.trim;
            $board-name = $board-name.trim;
            if !$slug || !$board-name {
                note 'Both slug and name are required';
                exit 1;
            }

            my $escaped-slug = $slug.subst("'", "''", :g);
            my $escaped-name = $board-name.subst("'", "''", :g);

            run-app-psql("INSERT INTO boards (slug, name) VALUES ('{$escaped-slug}', '{$escaped-name}');", :$profile);
        }

        default {
            note "Unknown admin command: {$cmd}";
            exit 1;
        }
    }
}

sub handle-app(Str $cmd) {
    given $cmd {
        when any <start> {
            run-or-die('nvm', 'use', '--lts');
            run-or-die('npm', 'run', 'dev');
        }

        default {
            note "Unknown app command: {$cmd}";
            exit 1;
        }
    }
}

sub handle-migrate() {
    my $database-url = require-database-url();
    say 'Applying schema from db/schema.sql';
    apply-schema($database-url);
    say 'Schema migration complete.';
}

sub handle-show-url() {
    say require-database-url();
}

sub print-help(Str :$profile) {
    my $script = $profile eq 'prod' ?? './bjprod' !! './bjdev';

    say 'Usage:';
    say "  {$script} db <up|down|nuke>";
    say "  {$script} admin <create-admin-user|create-user|approve|promote|rename|password-reset|board> [name]";
    say "  {$script} app <start>";
    say "  {$script} migrate";
    say "  {$script} show-url";
}

sub command-with-optional-name(@args --> List) {
    my $cmd = @args[0] // '';
    my $name = @args[1] // Nil;
    ($cmd, $name)
}

sub run-cli(Str :$profile = 'dev', *@args) is export {
    my @argv = @args;
    my $section = @argv.shift // 'help';

    given $section {
        when 'db' {
            my $cmd = @argv.shift // '';
            handle-db($cmd, :$profile);
        }

        when 'admin' {
            my ($cmd, $name) = command-with-optional-name(@argv);
            handle-admin($cmd, $name, :$profile);
        }

        when 'app' {
            my $cmd = @argv.shift // '';
            handle-app($cmd);
        }

        when 'migrate' {
            handle-migrate();
        }

        when 'show-url' {
            handle-show-url();
        }

        when any <help --help -h> {
            print-help(:$profile);
        }

        default {
            note "Unknown command: {$section}";
            print-help(:$profile);
            exit 1;
        }
    }
}
