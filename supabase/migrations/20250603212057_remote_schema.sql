CREATE UNIQUE INDEX users_email_unique ON auth.users USING btree (email);

alter table "auth"."users" add constraint "users_email_unique" UNIQUE using index "users_email_unique";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_invited_user_signup();


